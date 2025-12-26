// src/firebase/userNotificationPreferences.js
// User notification preferences management

import { db } from './config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

/**
 * Get default notification preferences for a new user
 * All channels enabled by default, all notification types enabled
 */
export const getDefaultUserPreferences = () => {
  return {
    // Master switch
    masterEnabled: true,
    
    // Channel toggles (Push/Email available to all, SMS/Call are premium)
    channels: {
      push: true,
      email: true,
      sms: false,   // Premium only
      call: false   // Premium only
    },
    
    // Per-notification-type preferences (each can have separate channel config)
    preferences: {
      // Event notifications
      eventCreated: { enabled: true, push: true, email: true, sms: false, call: false },
      eventModified: { enabled: true, push: true, email: false, sms: false, call: false },
      eventDeleted: { enabled: true, push: true, email: true, sms: false, call: false },
      eventCancelled: { enabled: true, push: true, email: true, sms: false, call: false },
      eventReminder: { enabled: true, push: true, email: false, sms: false, call: false },
      
      // Waitlist notifications
      freeSpotAvailable: { enabled: true, push: true, email: true, sms: false, call: false },
      waitlistPositionChange: { enabled: true, push: true, email: false, sms: false, call: false },
      
      // Substitution notifications
      substitutionRequest: { enabled: true, push: true, email: true, sms: false, call: false },
      substitutionCompleted: { enabled: true, push: true, email: false, sms: false, call: false },
      
      // Order notifications
      orderCreated: { enabled: true, push: true, email: true, sms: false, call: false },
      orderDeadline: { enabled: true, push: true, email: true, sms: false, call: false },
      
      // Chat notifications
      newChatMessage: { enabled: true, push: true, email: false, sms: false, call: false },
      
      // User management notifications
      userAdded: { enabled: true, push: true, email: true, sms: false, call: false },
      userRemoved: { enabled: true, push: true, email: true, sms: false, call: false },
      roleChanged: { enabled: true, push: true, email: true, sms: false, call: false },
      
      // Announcements
      clubAnnouncement: { enabled: true, push: true, email: true, sms: false, call: false },
      teamAnnouncement: { enabled: true, push: true, email: true, sms: false, call: false },
      
      // Lock period
      lockPeriodStarted: { enabled: true, push: true, email: false, sms: false, call: false }
    },
    
    // Quiet hours configuration
    quietHours: {
      enabled: false,
      startTime: '22:00',  // 10 PM
      endTime: '07:00',    // 7 AM
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
    
    // Muted clubs and teams
    mutedClubs: [],
    mutedTeams: [],
    
    // Metadata
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
};

/**
 * Get user notification preferences
 * @param {string} userId - User ID
 * @returns {Object} User preferences or defaults
 */
export const getUserNotificationPreferences = async (userId) => {
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'notificationPreferences');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    
    // Return defaults if not found
    return getDefaultUserPreferences();
  } catch (error) {
    console.error('Error getting user notification preferences:', error);
    return getDefaultUserPreferences();
  }
};

/**
 * Update user notification preferences
 * @param {string} userId - User ID
 * @param {Object} preferences - Preferences to update (partial update supported)
 * @returns {Object} Success status
 */
export const updateUserNotificationPreferences = async (userId, preferences) => {
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'notificationPreferences');
    
    // Check if document exists
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Update existing
      await updateDoc(docRef, {
        ...preferences,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new with defaults merged
      const defaults = getDefaultUserPreferences();
      await setDoc(docRef, {
        ...defaults,
        ...preferences,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating user notification preferences:', error);
    throw error;
  }
};

/**
 * Toggle master notification switch
 * @param {string} userId - User ID
 * @param {boolean} enabled - Enable or disable all notifications
 */
export const toggleMasterSwitch = async (userId, enabled) => {
  return await updateUserNotificationPreferences(userId, { masterEnabled: enabled });
};

/**
 * Toggle a specific channel (push, email, sms, call)
 * @param {string} userId - User ID
 * @param {string} channel - Channel name ('push', 'email', 'sms', 'call')
 * @param {boolean} enabled - Enable or disable
 */
export const toggleChannel = async (userId, channel, enabled) => {
  const prefs = await getUserNotificationPreferences(userId);
  const channels = prefs.channels || {};
  channels[channel] = enabled;
  
  return await updateUserNotificationPreferences(userId, { channels });
};

/**
 * Toggle a specific notification type
 * @param {string} userId - User ID
 * @param {string} notificationType - Notification type key (e.g., 'eventCreated')
 * @param {boolean} enabled - Enable or disable
 */
export const toggleNotificationType = async (userId, notificationType, enabled) => {
  const prefs = await getUserNotificationPreferences(userId);
  const preferences = prefs.preferences || {};
  
  if (!preferences[notificationType]) {
    preferences[notificationType] = { enabled, push: true, email: true, sms: false, call: false };
  } else {
    preferences[notificationType].enabled = enabled;
  }
  
  return await updateUserNotificationPreferences(userId, { preferences });
};

/**
 * Update channel for a specific notification type
 * @param {string} userId - User ID
 * @param {string} notificationType - Notification type key
 * @param {string} channel - Channel name
 * @param {boolean} enabled - Enable or disable
 */
export const updateNotificationTypeChannel = async (userId, notificationType, channel, enabled) => {
  const prefs = await getUserNotificationPreferences(userId);
  const preferences = prefs.preferences || {};
  
  if (!preferences[notificationType]) {
    preferences[notificationType] = { enabled: true, push: false, email: false, sms: false, call: false };
  }
  
  preferences[notificationType][channel] = enabled;
  
  return await updateUserNotificationPreferences(userId, { preferences });
};

/**
 * Update quiet hours settings
 * @param {string} userId - User ID
 * @param {Object} quietHoursConfig - { enabled, startTime, endTime, timezone }
 */
export const updateQuietHours = async (userId, quietHoursConfig) => {
  return await updateUserNotificationPreferences(userId, { quietHours: quietHoursConfig });
};

/**
 * Mute a club
 * @param {string} userId - User ID
 * @param {string} clubId - Club ID to mute
 */
export const muteClub = async (userId, clubId) => {
  const docRef = doc(db, 'users', userId, 'settings', 'notificationPreferences');
  
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      // Create with defaults first
      await setDoc(docRef, getDefaultUserPreferences());
    }
    
    await updateDoc(docRef, {
      mutedClubs: arrayUnion(clubId),
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error muting club:', error);
    throw error;
  }
};

/**
 * Unmute a club
 * @param {string} userId - User ID
 * @param {string} clubId - Club ID to unmute
 */
export const unmuteClub = async (userId, clubId) => {
  const docRef = doc(db, 'users', userId, 'settings', 'notificationPreferences');
  
  try {
    await updateDoc(docRef, {
      mutedClubs: arrayRemove(clubId),
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error unmuting club:', error);
    throw error;
  }
};

/**
 * Mute a team
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID to mute
 */
export const muteTeam = async (userId, teamId) => {
  const docRef = doc(db, 'users', userId, 'settings', 'notificationPreferences');
  
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, getDefaultUserPreferences());
    }
    
    await updateDoc(docRef, {
      mutedTeams: arrayUnion(teamId),
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error muting team:', error);
    throw error;
  }
};

/**
 * Unmute a team
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID to unmute
 */
export const unmuteTeam = async (userId, teamId) => {
  const docRef = doc(db, 'users', userId, 'settings', 'notificationPreferences');
  
  try {
    await updateDoc(docRef, {
      mutedTeams: arrayRemove(teamId),
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error unmuting team:', error);
    throw error;
  }
};

/**
 * Check if user should receive notification based on preferences
 * @param {Object} userPrefs - User preferences object
 * @param {string} notificationType - Type of notification (e.g., 'eventCreated')
 * @param {string} channel - Channel to send through ('push', 'email', 'sms', 'call')
 * @param {string} clubId - Club ID (optional, for mute check)
 * @param {string} teamId - Team ID (optional, for mute check)
 * @returns {boolean} - True if should send, false otherwise
 */
export const shouldSendNotification = (userPrefs, notificationType, channel, clubId = null, teamId = null) => {
  // Check master switch
  if (!userPrefs.masterEnabled) {
    return false;
  }
  
  // Check if channel is globally enabled
  if (!userPrefs.channels?.[channel]) {
    return false;
  }
  
  // Check if club is muted
  if (clubId && userPrefs.mutedClubs?.includes(clubId)) {
    return false;
  }
  
  // Check if team is muted
  if (teamId && userPrefs.mutedTeams?.includes(teamId)) {
    return false;
  }
  
  // Check notification type preferences
  const typePrefs = userPrefs.preferences?.[notificationType];
  if (!typePrefs) {
    return true; // Default to allow if not configured
  }
  
  // Check if notification type is enabled
  if (!typePrefs.enabled) {
    return false;
  }
  
  // Check if channel is enabled for this notification type
  if (!typePrefs[channel]) {
    return false;
  }
  
  return true;
};

/**
 * Check if current time is within quiet hours
 * @param {Object} quietHours - Quiet hours config { enabled, startTime, endTime, timezone }
 * @returns {boolean} - True if within quiet hours, false otherwise
 */
export const isWithinQuietHours = (quietHours) => {
  if (!quietHours?.enabled) {
    return false;
  }
  
  try {
    const now = new Date();
    const userTimezone = quietHours.timezone || 'UTC';
    
    // Get current time in user's timezone
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    // Parse start and end times
    const [startHour, startMinute] = quietHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = quietHours.endTime.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;
    
    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startTimeInMinutes > endTimeInMinutes) {
      // Quiet hours span midnight
      return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
    } else {
      // Quiet hours within same day
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error);
    return false;
  }
};

/**
 * Get list of notification types that are critical and bypass quiet hours
 */
export const getCriticalNotificationTypes = () => {
  return [
    'freeSpotAvailable',      // Time-sensitive
    'substitutionRequest',     // Time-sensitive
    'eventCancelled',          // Important
    'eventDeleted',            // Important
    'orderDeadline',           // Time-sensitive
    'lockPeriodStarted'        // Time-sensitive
  ];
};

/**
 * Check if notification should bypass quiet hours
 * @param {string} notificationType - Type of notification
 * @returns {boolean} - True if should bypass quiet hours
 */
export const shouldBypassQuietHours = (notificationType) => {
  const criticalTypes = getCriticalNotificationTypes();
  return criticalTypes.includes(notificationType);
};




