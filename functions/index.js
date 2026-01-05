// functions/index.js - FIXED VERSION with FCM v1 API
// Firebase Cloud Functions for Push Notifications

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');

admin.initializeApp();

exports.setCustomClaims = functions.https.onCall(async (data, context) => {
  const { userId, role, isSuperAdmin } = data;
  await admin.auth().setCustomUserClaims(userId, { role, isSuperAdmin });
  return { success: true };
});

// ============================================================================
// DELETE USER ACCOUNT (Called from client)
// ============================================================================

/**
 * Callable function to delete user account
 * This ensures proper deletion of both Auth and Firestore data
 */
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  // Must be authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const userId = context.auth.uid;
  const db = admin.firestore();
  
  console.log('═══════════════════════════════════════');
  console.log('🗑️ USER ACCOUNT DELETION REQUEST');
  console.log(`👤 User ID: ${userId}`);
  console.log('═══════════════════════════════════════');
  
  try {
    // 1. First delete all child subaccounts
    console.log('👨‍👩‍👧 Checking for child subaccounts...');
    const parentRelationships = await db.collection('parentChildRelationships')
      .where('parentId', '==', userId)
      .where('status', '==', 'active')
      .get();
    
    const childrenDeleted = [];
    for (const relDoc of parentRelationships.docs) {
      const rel = relDoc.data();
      if (rel.childId) {
        try {
          // Delete child's Auth account
          try {
            await admin.auth().deleteUser(rel.childId);
            console.log(`  ✅ Deleted child Auth: ${rel.childId}`);
          } catch (authError) {
            if (authError.code !== 'auth/user-not-found') {
              console.error(`  ⚠️ Error deleting child Auth:`, authError.message);
            }
          }
          
          // Delete child's Firestore document (this will trigger cleanup)
          await db.collection('users').doc(rel.childId).delete();
          console.log(`  ✅ Deleted child Firestore: ${rel.childId}`);
          childrenDeleted.push(rel.childId);
        } catch (error) {
          console.error(`  ❌ Error deleting child ${rel.childId}:`, error.message);
        }
      }
    }
    
    if (childrenDeleted.length > 0) {
      console.log(`✅ Deleted ${childrenDeleted.length} child subaccount(s)`);
    }
    
    // 2. Delete the main user's Firestore document
    // This will trigger the onUserDeleted function to clean up all data
    console.log('🗑️ Deleting Firestore user document...');
    await db.collection('users').doc(userId).delete();
    console.log('✅ Firestore user document deleted');
    
    // 3. Delete Firebase Auth user (using Admin SDK for reliability)
    console.log('🔐 Deleting Firebase Auth user...');
    await admin.auth().deleteUser(userId);
    console.log('✅ Firebase Auth user deleted');
    
    console.log('═══════════════════════════════════════');
    console.log('✅ USER ACCOUNT DELETION COMPLETED');
    console.log('═══════════════════════════════════════');
    
    return { 
      success: true, 
      message: 'Account deleted successfully',
      childrenDeleted: childrenDeleted.length 
    };
    
  } catch (error) {
    console.error('═══════════════════════════════════════');
    console.error('❌ USER ACCOUNT DELETION FAILED');
    console.error('Error:', error);
    console.error('═══════════════════════════════════════');
    throw new functions.https.HttpsError('internal', `Failed to delete account: ${error.message}`);
  }
});

// ============================================================================
// USER NOTIFICATION PREFERENCES SYSTEM
// ============================================================================

/**
 * Get user notification preferences
 */
async function getUserNotificationPreferences(userId) {
  try {
    const prefDoc = await admin.firestore()
      .doc(`users/${userId}/settings/notificationPreferences`)
      .get();
    
    if (prefDoc.exists) {
      return prefDoc.data();
    }
    
    // Return defaults if not found (all enabled)
    return {
      masterEnabled: true,
      channels: { push: true, email: true, sms: false, call: false },
      preferences: {},
      quietHours: { enabled: false },
      mutedClubs: [],
      mutedTeams: []
    };
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return null;
  }
}

/**
 * Check if user should receive notification based on their preferences
 */
function shouldSendToUser(userPrefs, notificationType, channel, clubId = null, teamId = null) {
  // No preferences = allow (fail open)
  if (!userPrefs) return true;
  
  // Master switch disabled = block all
  if (userPrefs.masterEnabled === false) {
    console.log('❌ User has master switch disabled');
    return false;
  }
  
  // Channel globally disabled
  if (userPrefs.channels && userPrefs.channels[channel] === false) {
    console.log(`❌ User has ${channel} channel disabled`);
    return false;
  }
  
  // Club muted
  if (clubId && userPrefs.mutedClubs && userPrefs.mutedClubs.includes(clubId)) {
    console.log(`❌ User has club ${clubId} muted`);
    return false;
  }
  
  // Team muted
  if (teamId && userPrefs.mutedTeams && userPrefs.mutedTeams.includes(teamId)) {
    console.log(`❌ User has team ${teamId} muted`);
    return false;
  }
  
  // Check notification type preferences
  if (userPrefs.preferences && userPrefs.preferences[notificationType]) {
    const typePref = userPrefs.preferences[notificationType];
    
    // Type globally disabled
    if (typePref.enabled === false) {
      console.log(`❌ User has ${notificationType} disabled`);
      return false;
    }
    
    // Channel disabled for this type
    if (typePref[channel] === false) {
      console.log(`❌ User has ${channel} disabled for ${notificationType}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Check if current time is within user's quiet hours
 */
function isWithinQuietHours(quietHours) {
  if (!quietHours || !quietHours.enabled) return false;
  
  try {
    const now = new Date();
    const timezone = quietHours.timezone || 'UTC';
    
    // Get current time in user's timezone
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    // Parse quiet hours
    const [startHour, startMinute] = (quietHours.startTime || '22:00').split(':').map(Number);
    const [endHour, endMinute] = (quietHours.endTime || '07:00').split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;
    
    // Handle overnight quiet hours
    if (startTimeInMinutes > endTimeInMinutes) {
      return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
    } else {
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error);
    return false;
  }
}

/**
 * Check if notification type is critical (bypasses quiet hours)
 */
function isCriticalNotification(notificationType) {
  const criticalTypes = [
    'freeSpotAvailable',
    'substitutionRequest',
    'eventCancelled',
    'eventDeleted',
    'orderDeadline',
    'lockPeriodStarted'
  ];
  return criticalTypes.includes(notificationType);
}

/**
 * Filter users based on their notification preferences
 * Returns object with { push: [userIds], email: [userIds], sms: [userIds], call: [userIds] }
 */
async function filterUsersByPreferences(userIds, notificationType, clubId = null, teamId = null) {
  const filteredUsers = {
    push: [],
    email: [],
    sms: [],
    call: []
  };
  
  const isCritical = isCriticalNotification(notificationType);
  
  for (const userId of userIds) {
    const prefs = await getUserNotificationPreferences(userId);
    
    if (!prefs) {
      // No prefs = allow all channels (default)
      filteredUsers['push'].push(userId);
      filteredUsers['email'].push(userId);
      console.log(`✅ User ${userId} has no prefs, allowing all channels`);
      continue;
    }
    
    // Check quiet hours (only for non-critical)
    const inQuietHours = !isCritical && isWithinQuietHours(prefs.quietHours);
    if (inQuietHours) {
      console.log(`⏰ User ${userId} is in quiet hours, skipping non-critical notification`);
      continue;
    }
    
    // Check each channel
    for (const channel of ['push', 'email', 'sms', 'call']) {
      if (shouldSendToUser(prefs, notificationType, channel, clubId, teamId)) {
        filteredUsers[channel].push(userId);
      }
    }
  }
  
  console.log(`📊 Filtered users for ${notificationType}:`);
  console.log(`   Push: ${filteredUsers.push.length}`);
  console.log(`   Email: ${filteredUsers.email.length}`);
  console.log(`   SMS: ${filteredUsers.sms.length}`);
  console.log(`   Call: ${filteredUsers.call.length}`);
  
  return filteredUsers;
}

// ============================================================================
// CLUB/TEAM NOTIFICATION SETTINGS (LEGACY - OVERRIDDEN BY USER PREFS)
// ============================================================================

async function areNotificationsEnabled(clubId, teamId, notificationType) {
  try {
    const path = teamId 
      ? `clubs/${clubId}/teams/${teamId}/notificationSettings/config`
      : `clubs/${clubId}/notificationSettings/config`;
    
    const settingsDoc = await admin.firestore().doc(path).get();
    
    // Default to TRUE if no settings exist (notifications enabled by default)
    // Note: In Admin SDK, .exists is a property, not a function
    if (!settingsDoc.exists) {
      console.log('⚙️ No notification settings found, defaulting to enabled');
      return true;
    }
    
    const settings = settingsDoc.data();
    const parts = notificationType.split('.');
    let value = settings;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        // Default to TRUE if setting not found
        return true;
      }
    }
    
    return value !== false; // Enabled unless explicitly disabled
  } catch (error) {
    console.error('Error checking notification settings:', error);
    // Default to TRUE on error (fail open, not closed)
    return true;
  }
}

async function sendEmailNotification(userIds, subject, body, notificationType = null, clubId = null, teamId = null) {
  try {
    let filteredUserIds = userIds;
    
    // Filter by user preferences if notification type provided
    if (notificationType) {
      const filtered = await filterUsersByPreferences(userIds, notificationType, clubId, teamId);
      filteredUserIds = filtered.email;
    }
    
    if (filteredUserIds.length === 0) {
      console.log('ℹ️ No users eligible for email after preference filtering');
      return;
    }
    
    const emails = [];
    for (const userId of filteredUserIds) {
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        const email = userDoc.data().email;
        if (email) emails.push(email);
      }
    }
    
    if (emails.length === 0) return;
    
    await admin.firestore().collection('emailQueue').add({
      to: emails,
      message: {
        subject: subject,
        text: body,
        html: body
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✉️ Email queued for ${emails.length} recipients`);
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}


/**
 * Helper function to send notifications using FCM v1 API
 * Sends to multiple tokens in batches of 500 (FCM limit)
 */
async function sendMulticastNotification(tokens, notification, data = {}) {
  if (!tokens || tokens.length === 0) {
    console.log('No tokens provided');
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  console.log(`Sending notification to ${tokens.length} tokens`);
  
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  // FCM allows max 500 tokens per batch
  const batchSize = 500;
  
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batchTokens = tokens.slice(i, i + batchSize);
    
    try {
      // Use sendEachForMulticast instead of sendMulticast
      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: data,
        tokens: batchTokens
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      successCount += response.successCount;
      failureCount += response.failureCount;

      // Collect invalid tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(batchTokens[idx]);
          }
          console.log(`Failed to send to token ${idx}:`, error.code);
        }
      });

    } catch (error) {
      console.error(`Error sending batch ${i / batchSize}:`, error);
      failureCount += batchTokens.length;
    }
  }

  console.log(`✅ Successfully sent: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  
  if (invalidTokens.length > 0) {
    console.log(`🗑️ Invalid tokens to clean up: ${invalidTokens.length}`);
  }

  return { successCount, failureCount, invalidTokens };
}

/**
 * Helper function to get FCM tokens for multiple users
 */
async function getUserTokens(userIds) {
  const tokens = [];
  
  for (const userId of userIds) {
    try {
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const userTokens = userData.fcmTokens || [];
        tokens.push(...userTokens);
      }
    } catch (error) {
      console.error(`Error getting tokens for user ${userId}:`, error);
    }
  }
  
  return tokens;
}

/**
 * Helper function to clean up invalid tokens
 */
async function cleanupInvalidTokens(invalidTokens) {
  console.log(`Cleaning up ${invalidTokens.length} invalid tokens`);
  
  const usersSnapshot = await admin.firestore()
    .collection('users')
    .get();
  
  const batch = admin.firestore().batch();
  let updatesCount = 0;

  usersSnapshot.forEach((doc) => {
    const userData = doc.data();
    const userTokens = userData.fcmTokens || [];
    
    // Filter out invalid tokens
    const validTokens = userTokens.filter(token => !invalidTokens.includes(token));
    
    if (validTokens.length !== userTokens.length) {
      batch.update(doc.ref, { fcmTokens: validTokens });
      updatesCount++;
    }
  });

  if (updatesCount > 0) {
    await batch.commit();
    console.log(`✅ Cleaned up tokens from ${updatesCount} users`);
  }
}

/**
 * Helper function to send push notification to a single user
 * @param {string} userId - User ID to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
async function sendPushNotification(userId, title, body, data = {}) {
  try {
    // Save in-app notification
    try {
      await admin.firestore().collection('notifications').add({
        userId: userId,
        type: data.type || 'general',
        title: title,
        body: body,
        data: data,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
        clubId: data.clubId || null,
        teamId: data.teamId || null,
        eventId: data.eventId || null,
        chatId: data.chatId || null,
        actionUrl: data.actionUrl || null
      });
      console.log(`💾 Saved in-app notification for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error saving in-app notification for user ${userId}:`, error);
    }
    
    // Check user notification preferences
    const prefs = await getUserNotificationPreferences(userId);
    const notificationType = data.type || 'general';
    const shouldSendPush = shouldSendToUser(prefs, notificationType, 'push', data.clubId, data.teamId);
    
    console.log(`📱 User ${userId} push notification preference for ${notificationType}: ${shouldSendPush}`);
    
    if (!shouldSendPush) {
      console.log(`ℹ️ Push notification skipped for user ${userId} due to preferences`);
      return { success: true, reason: 'user_preferences' };
    }
    
    // Get user's FCM tokens
    const tokens = await getUserTokens([userId]);
    
    if (tokens.length === 0) {
      console.log(`No FCM tokens found for user ${userId}`);
      return { success: false, reason: 'no_tokens' };
    }

    // Send push notification
    const result = await sendMulticastNotification(
      tokens,
      { title, body },
      data
    );

    // Clean up invalid tokens
    if (result.invalidTokens.length > 0) {
      await cleanupInvalidTokens(result.invalidTokens);
    }

    return { 
      success: result.successCount > 0,
      successCount: result.successCount,
      failureCount: result.failureCount
    };
  } catch (error) {
    console.error(`Error sending push notification to user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to multiple FCM tokens
 * Callable function from client
 */
exports.sendNotification = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to send notifications'
    );
  }

  const { tokens, notification } = data;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Tokens array is required'
    );
  }

  if (!notification || !notification.title || !notification.body) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Notification must have title and body'
    );
  }

  try {
    const result = await sendMulticastNotification(
      tokens,
      notification,
      notification.data || {}
    );

    // Clean up invalid tokens
    if (result.invalidTokens.length > 0) {
      await cleanupInvalidTokens(result.invalidTokens);
    }

    return {
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Firestore Trigger: Send notification when event is created
 */
exports.onEventCreated = functions.firestore
  .document('events/{eventId}')
  .onCreate(async (snap, context) => {
    const event = snap.data();
    const eventId = context.params.eventId;
    
    console.log('📅 New event created:', event.title);

    try {
      // Check if notifications are enabled
      const pushEnabled = await areNotificationsEnabled(
        event.clubId,
        event.teamId,
        'push.events.created'
      );
      
      const emailEnabled = await areNotificationsEnabled(
        event.clubId,
        event.teamId,
        'email.events.created'
      );
      
      if (!pushEnabled && !emailEnabled) {
        console.log('ℹ️ All notifications disabled for new events');
        return;
      }

      // Get club data to find all users who can see this event
      const clubDoc = await admin.firestore()
        .collection('clubs')
        .doc(event.clubId)
        .get();
      
      if (!clubDoc.exists) {
        console.log('⚠️ Club not found');
        return;
      }

      const clubData = clubDoc.data();
      let targetUserIds = new Set();

      // If event is for specific team, get team members
      if (event.teamId) {
        console.log('🔍 Looking for team in club:', event.clubId, '/', event.teamId);
        
        // Teams are stored as an array field in the club document, not as a subcollection
        const teamData = (clubData.teams || []).find(t => t.id === event.teamId);
        
        if (teamData) {
          console.log('📋 Team data found:', {
            name: teamData.name,
            members: teamData.members || [],
            assistants: teamData.assistants || [],
            trainers: teamData.trainers || []
          });
          (teamData.members || []).forEach(id => targetUserIds.add(id));
          (teamData.assistants || []).forEach(id => targetUserIds.add(id));
          (teamData.trainers || []).forEach(id => targetUserIds.add(id));
        } else {
          console.log('⚠️ Team not found in club.teams array!');
        }
      } else {
        // Event for all club members (no specific team)
        console.log('📢 Club-wide event - notifying all members');
        (clubData.members || []).forEach(id => targetUserIds.add(id));
        (clubData.admins || []).forEach(id => targetUserIds.add(id));
        (clubData.trainers || []).forEach(id => targetUserIds.add(id));
        
        // Include all team members from all teams in the club
        // Teams are stored as an array field in the club document
        (clubData.teams || []).forEach(team => {
          (team.members || []).forEach(id => targetUserIds.add(id));
          (team.assistants || []).forEach(id => targetUserIds.add(id));
          (team.trainers || []).forEach(id => targetUserIds.add(id));
        });
      }

      // Delete chats when club is deleted
      exports.onClubDeleted = functions.firestore
        .document('clubs/{clubId}')
        .onDelete(async (snap, context) => {
          const clubId = context.params.clubId;
          
          // Delete all chats for this club
          const chatsSnapshot = await admin.firestore()
            .collection('chats')
            .where('clubId', '==', clubId)
            .get();
          
          const batch = admin.firestore().batch();
          chatsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          await batch.commit();
          console.log(`Deleted ${chatsSnapshot.size} chats for club ${clubId}`);
        });


      // Convert Set to Array and remove event creator
      console.log('📊 Raw target user IDs:', Array.from(targetUserIds));
      console.log('🚫 Event creator (to be excluded):', event.createdBy);
      targetUserIds = Array.from(targetUserIds).filter(id => id !== event.createdBy);
      console.log('✅ Target users after filtering:', targetUserIds);

      if (targetUserIds.length === 0) {
        console.log('ℹ️ No users to notify (all filtered out or no members)');
        return;
      }

      console.log(`👥 Initial target users: ${targetUserIds.length}`);

      // Filter users by their notification preferences
      const filteredUsers = await filterUsersByPreferences(
        targetUserIds,
        'eventCreated',
        event.clubId,
        event.teamId
      );

      // Format date and time for notifications
      const eventDate = event.date ? new Date(event.date).toLocaleDateString() : 'TBD';
      const eventTime = event.startTime || event.time || '';
      const dateTimeText = eventTime ? `${eventDate} at ${eventTime}` : eventDate;
      
      // Create in-app notifications for ALL eligible users (regardless of push/email preference)
      console.log(`💾 Creating in-app notifications for ${filteredUsers.push.length + filteredUsers.email.length} users`);
      const allNotifiedUsers = new Set([...filteredUsers.push, ...filteredUsers.email]);
      
      for (const userId of allNotifiedUsers) {
        try {
          await admin.firestore().collection('notifications').add({
            userId: userId,
            type: 'event',
            title: '📅 New Event Created',
            body: `${event.title} - ${dateTimeText}`,
            data: {
              eventId: eventId,
              clubId: event.clubId,
              teamId: event.teamId || '',
              eventTitle: event.title,
              eventDate: event.date,
              eventTime: eventTime
            },
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            clubId: event.clubId,
            teamId: event.teamId || null,
            eventId: eventId,
            actionUrl: `/event/${eventId}`
          });
        } catch (error) {
          console.error(`❌ Error creating in-app notification for user ${userId}:`, error);
        }
      }
      
      // Send push notifications to users who want them
      if (pushEnabled && filteredUsers.push.length > 0) {
        const tokens = await getUserTokens(filteredUsers.push);

        if (tokens.length > 0) {
          console.log(`🔔 Sending push to ${tokens.length} devices`);
          
          const result = await sendMulticastNotification(
            tokens,
            {
              title: '📅 New Event Created',
              body: `${event.title} - ${dateTimeText}`
            },
            {
              type: 'event_new',
              eventId: eventId,
              clubId: event.clubId,
              teamId: event.teamId || ''
            }
          );

          // Clean up invalid tokens
          if (result.invalidTokens.length > 0) {
            await cleanupInvalidTokens(result.invalidTokens);
          }
        }
      }

      // Send email notifications to users who want them
      if (emailEnabled && filteredUsers.email.length > 0) {
        // Format date and time for email
        const eventDate = event.date ? new Date(event.date).toLocaleDateString() : 'TBD';
        const eventTime = event.startTime || event.time || 'Not specified';
        
        await sendEmailNotification(
          filteredUsers.email,
          `📅 New Event: ${event.title}`,
          `A new event has been created:\n\n${event.title}\nDate: ${eventDate}\nTime: ${eventTime}\nLocation: ${event.location || 'TBD'}\n\nCheck the app for more details.`,
          'eventCreated',
          event.clubId,
          event.teamId
        );
      }

      console.log('✅ Event notification complete');
      
      // Schedule reminders for this event
      await scheduleEventReminders(eventId, event);
      
      // Schedule lock notification if enabled
      await scheduleLockNotification(eventId, event);
    } catch (error) {
      console.error('❌ Error sending event notification:', error);
    }
  });

/**
 * Firestore Trigger: Send notification when event is updated
 */
exports.onEventUpdated = functions.firestore
  .document('events/{eventId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check if meaningful fields changed
    const hasChanged = 
      before.title !== after.title ||
      before.date !== after.date ||
      before.startTime !== after.startTime ||
      before.time !== after.time ||
      before.duration !== after.duration ||
      before.endTime !== after.endTime ||
      before.location !== after.location ||
      before.description !== after.description;
    
    if (!hasChanged) {
      console.log('ℹ️ No meaningful changes detected');
      return;
    }

    console.log('📝 Event updated:', after.title);

    try {
      // Check if notifications are enabled
      const pushEnabled = await areNotificationsEnabled(
        after.clubId,
        after.teamId,
        'push.events.updated'
      );
      
      const emailEnabled = await areNotificationsEnabled(
        after.clubId,
        after.teamId,
        'email.events.updated'
      );
      
      if (!pushEnabled && !emailEnabled) {
        console.log('ℹ️ Notifications disabled for event updates');
        return;
      }

      // Get club data to find all users who can see this event
      const clubDoc = await admin.firestore()
        .collection('clubs')
        .doc(after.clubId)
        .get();
      
      if (!clubDoc.exists) {
        console.log('⚠️ Club not found');
        return;
      }

      const clubData = clubDoc.data();
      let targetUserIds = new Set();

      // If event is for specific team, get team members
      if (after.teamId) {
        console.log('🔍 Looking for team members to notify about update');
        const teamData = (clubData.teams || []).find(t => t.id === after.teamId);
        
        if (teamData) {
          (teamData.members || []).forEach(id => targetUserIds.add(id));
          (teamData.assistants || []).forEach(id => targetUserIds.add(id));
          (teamData.trainers || []).forEach(id => targetUserIds.add(id));
        }
      } else {
        // Event for all club members
        (clubData.members || []).forEach(id => targetUserIds.add(id));
        (clubData.admins || []).forEach(id => targetUserIds.add(id));
        (clubData.trainers || []).forEach(id => targetUserIds.add(id));
        
        (clubData.teams || []).forEach(team => {
          (team.members || []).forEach(id => targetUserIds.add(id));
          (team.assistants || []).forEach(id => targetUserIds.add(id));
          (team.trainers || []).forEach(id => targetUserIds.add(id));
        });
      }

      // Convert to array and remove event creator
      targetUserIds = Array.from(targetUserIds).filter(id => id !== after.createdBy);

      if (targetUserIds.length === 0) {
        console.log('ℹ️ No users to notify about update');
        return;
      }

      console.log(`👥 Notifying ${targetUserIds.length} users about event update`);

      // Determine what changed
      let changeDescription = '';
      if (before.title !== after.title) changeDescription = 'Title changed';
      else if (before.date !== after.date || before.startTime !== after.startTime || before.time !== after.time || before.duration !== after.duration || before.endTime !== after.endTime) changeDescription = 'Time changed';
      else if (before.location !== after.location) changeDescription = 'Location changed';
      else if (before.description !== after.description) changeDescription = 'Description changed';
      else changeDescription = 'Event updated';

      // Filter users by their notification preferences
      const filteredUsers = await filterUsersByPreferences(
        targetUserIds,
        'eventModified',
        after.clubId,
        after.teamId
      );

      // Create in-app notifications for ALL eligible users
      console.log(`💾 Creating in-app notifications for ${filteredUsers.push.length + filteredUsers.email.length} users`);
      const allNotifiedUsers = new Set([...filteredUsers.push, ...filteredUsers.email]);
      
      for (const userId of allNotifiedUsers) {
        try {
          await admin.firestore().collection('notifications').add({
            userId: userId,
            type: 'event_update',
            title: '📝 Event Modified',
            body: `${after.title} - ${changeDescription}`,
            data: {
              eventId: context.params.eventId,
              clubId: after.clubId,
              teamId: after.teamId || '',
              eventTitle: after.title,
              changeDescription: changeDescription
            },
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
            clubId: after.clubId,
            teamId: after.teamId || null,
            eventId: context.params.eventId,
            actionUrl: `/event/${context.params.eventId}`
          });
        } catch (error) {
          console.error(`❌ Error creating in-app notification for user ${userId}:`, error);
        }
      }

      // Send push notifications to users who want them
      if (pushEnabled && filteredUsers.push.length > 0) {
        const tokens = await getUserTokens(filteredUsers.push);

        if (tokens.length > 0) {
          console.log(`🔔 Sending push to ${tokens.length} devices`);

          const result = await sendMulticastNotification(
            tokens,
            {
              title: '📝 Event Modified',
              body: `${after.title} - ${changeDescription}`
            },
            {
              type: 'event_modified',
              eventId: context.params.eventId,
              clubId: after.clubId,
              teamId: after.teamId || ''
            }
          );

          // Clean up invalid tokens
          if (result.invalidTokens.length > 0) {
            await cleanupInvalidTokens(result.invalidTokens);
          }
        }
      }

      // Send email notifications to users who want them
      if (emailEnabled && filteredUsers.email.length > 0) {
        await sendEmailNotification(
          filteredUsers.email,
          `📝 Event Updated: ${after.title}`,
          `The event "${after.title}" has been updated.\n\n${changeDescription}\n\nCheck the app for updated details.`,
          'eventModified',
          after.clubId,
          after.teamId
        );
      }

      console.log('✅ Event update notification complete');
      
      // Cancel old reminders and reschedule if date/time changed
      if (before.date !== after.date || before.time !== after.time || 
          JSON.stringify(before.reminders) !== JSON.stringify(after.reminders)) {
        await cancelEventReminders(context.params.eventId);
        await scheduleEventReminders(context.params.eventId, after);
      }
      
      // Cancel and reschedule lock notification if lock period changed
      if (JSON.stringify(before.lockPeriod) !== JSON.stringify(after.lockPeriod)) {
        await cancelLockNotification(context.params.eventId);
        await scheduleLockNotification(context.params.eventId, after);
      }
    } catch (error) {
      console.error('❌ Error sending event update notification:', error);
    }
  });

/**
 * Firestore Trigger: Send notification when event is deleted
 */
exports.onEventDeleted = functions.firestore
  .document('events/{eventId}')
  .onDelete(async (snap, context) => {
    const event = snap.data();
    
    console.log('🗑️ Event deleted:', event.title);

    try {
      // Check if notifications are enabled
      const pushEnabled = await areNotificationsEnabled(
        event.clubId,
        event.teamId,
        'push.events.deleted'
      );
      
      
      const emailEnabled = await areNotificationsEnabled(
        event.clubId,
        event.teamId,
        'email.events.deleted'
      );
      
      if (!pushEnabled && !emailEnabled) {
        console.log('ℹ️ Notifications disabled for event deletions');
        return;
      }

      // Get club data to find all users who can see this event
      const clubDoc = await admin.firestore()
        .collection('clubs')
        .doc(event.clubId)
        .get();
      
      if (!clubDoc.exists) {
        console.log('⚠️ Club not found');
        return;
      }

      const clubData = clubDoc.data();
      let targetUserIds = new Set();

      // If event is for specific team, get team members
      if (event.teamId) {
        console.log('🔍 Looking for team members to notify about deletion');
        const teamData = (clubData.teams || []).find(t => t.id === event.teamId);
        
        if (teamData) {
          (teamData.members || []).forEach(id => targetUserIds.add(id));
          (teamData.assistants || []).forEach(id => targetUserIds.add(id));
          (teamData.trainers || []).forEach(id => targetUserIds.add(id));
        }
      } else {
        // Event for all club members
        (clubData.members || []).forEach(id => targetUserIds.add(id));
        (clubData.admins || []).forEach(id => targetUserIds.add(id));
        (clubData.trainers || []).forEach(id => targetUserIds.add(id));
        
        (clubData.teams || []).forEach(team => {
          (team.members || []).forEach(id => targetUserIds.add(id));
          (team.assistants || []).forEach(id => targetUserIds.add(id));
          (team.trainers || []).forEach(id => targetUserIds.add(id));
        });
      }

      // Convert to array and remove event creator
      targetUserIds = Array.from(targetUserIds);

      if (targetUserIds.length === 0) {
        console.log('ℹ️ No users to notify about deletion');
        return;
      }

      console.log(`👥 Notifying ${targetUserIds.length} users about event deletion`);

      // Filter users by their notification preferences (eventDeleted is critical)
      const filteredUsers = await filterUsersByPreferences(
        targetUserIds,
        'eventDeleted',
        event.clubId,
        event.teamId
      );

      // Create in-app notifications for ALL eligible users
      console.log(`💾 Creating in-app notifications for ${filteredUsers.push.length + filteredUsers.email.length} users`);
      const allNotifiedUsers = new Set([...filteredUsers.push, ...filteredUsers.email]);
      
      for (const userId of allNotifiedUsers) {
        try {
          await admin.firestore().collection('notifications').add({
            userId: userId,
            type: 'event_delete',
            title: '❌ Event Cancelled',
            body: `${event.title} has been cancelled`,
            data: {
              eventId: context.params.eventId,
              clubId: event.clubId,
              teamId: event.teamId || '',
              eventTitle: event.title
            },
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
            clubId: event.clubId,
            teamId: event.teamId || null,
            eventId: context.params.eventId,
            actionUrl: null
          });
        } catch (error) {
          console.error(`❌ Error creating in-app notification for user ${userId}:`, error);
        }
      }

      // Send push notifications to users who want them
      if (pushEnabled && filteredUsers.push.length > 0) {
        const tokens = await getUserTokens(filteredUsers.push);

        if (tokens.length > 0) {
          console.log(`🔔 Sending push to ${tokens.length} devices`);

          const result = await sendMulticastNotification(
            tokens,
            {
              title: '❌ Event Cancelled',
              body: `${event.title} has been cancelled`
            },
            {
              type: 'event_deleted',
              eventId: context.params.eventId,
              clubId: event.clubId,
              teamId: event.teamId || ''
            }
          );

          // Clean up invalid tokens
          if (result.invalidTokens.length > 0) {
            await cleanupInvalidTokens(result.invalidTokens);
          }
        }
      }

      // Send email notifications to users who want them
      if (emailEnabled && filteredUsers.email.length > 0) {
        await sendEmailNotification(
          filteredUsers.email,
          `❌ Event Cancelled: ${event.title}`,
          `The event "${event.title}" has been cancelled.\n\nPlease check the app for more information.`,
          'eventDeleted',
          event.clubId,
          event.teamId
        );
      }

      console.log('✅ Event deletion notification complete');
      
      // Cancel all pending reminders for this event
      await cancelEventReminders(context.params.eventId);
      
      // Cancel lock notification
      await cancelLockNotification(context.params.eventId);
    } catch (error) {
      console.error('❌ Error sending event deletion notification:', error);
    }
  });

/**
 * Scheduled function to check order deadlines
 * Runs daily at 9 AM
 */
exports.checkOrderDeadlines = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Europe/Bratislava')
  .onRun(async (context) => {
    console.log('⏰ Checking order deadlines...');
    
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get all orders with deadline tomorrow
      const ordersSnapshot = await admin.firestore()
        .collection('orders')
        .where('deadline', '>=', now.toISOString())
        .where('deadline', '<', tomorrow.toISOString())
        .where('status', '==', 'open')
        .get();

      console.log(`Found ${ordersSnapshot.size} orders expiring tomorrow`);

      for (const orderDoc of ordersSnapshot.docs) {
        const order = orderDoc.data();
        
        // Get club admins
        const clubDoc = await admin.firestore()
          .collection('clubs')
          .doc(order.clubId)
          .get();
        
        if (!clubDoc.exists) continue;
        
        const clubData = clubDoc.data();
        const adminIds = clubData.admins || [];

        if (adminIds.length === 0) continue;

        // Get tokens
        const tokens = await getUserTokens(adminIds);

        if (tokens.length === 0) continue;

        // Send reminder
        await sendMulticastNotification(
          tokens,
          {
            title: '⏰ Order Deadline Reminder',
            body: `Order "${order.productName}" closes tomorrow!`
          },
          {
            type: 'order_deadline',
            orderId: orderDoc.id,
            clubId: order.clubId
          }
        );
      }

      console.log('✅ Order deadline check complete');
    } catch (error) {
      console.error('❌ Error checking order deadlines:', error);
    }
  });

/**
 * Firestore Trigger: Send notification when new order is created
 */
exports.onOrderCreated = functions.firestore
  .document('orderTemplates/{orderId}')
  .onCreate(async (snap, context) => {
    const order = snap.data();
    
    console.log('🛒 New order created:', order.productName);

    try {
      // Check if notifications are enabled
      const pushEnabled = await areNotificationsEnabled(
        order.clubId,
        null,
        'push.orders.created'
      );
      
      const emailEnabled = await areNotificationsEnabled(
        order.clubId,
        null,
        'email.orders.created'
      );
      
      if (!pushEnabled && !emailEnabled) {
        console.log('ℹ️ Notifications disabled for new orders');
        return;
      }

      // Get club data
      const clubDoc = await admin.firestore()
        .collection('clubs')
        .doc(order.clubId)
        .get();
      
      if (!clubDoc.exists) {
        console.log('⚠️ Club not found');
        return;
      }

      const clubData = clubDoc.data();
      let targetUserIds = [];

      // Notify all club members
      targetUserIds = [
        ...(clubData.members || []),
        ...(clubData.admins || [])
      ];

      // Remove duplicates and order creator
      targetUserIds = Array.from(new Set(targetUserIds)).filter(id => id !== order.createdBy);

      if (targetUserIds.length === 0) {
        console.log('ℹ️ No users to notify');
        return;
      }

      console.log(`👥 Notifying ${targetUserIds.length} users`);

      // Send push notifications if enabled
      if (pushEnabled) {
        // Get FCM tokens
        const tokens = await getUserTokens(targetUserIds);

        if (tokens.length > 0) {
          console.log(`🔔 Sending push to ${tokens.length} devices`);

          // Send notification
          const result = await sendMulticastNotification(
            tokens,
            {
              title: '🛒 New Order Available',
              body: `${order.productName} - Order now!`
            },
            {
              type: 'order_new',
              orderId: context.params.orderId,
              clubId: order.clubId
            }
          );

          // Clean up invalid tokens
          if (result.invalidTokens.length > 0) {
            await cleanupInvalidTokens(result.invalidTokens);
          }
        }
      }

      // Send email notifications if enabled
      if (emailEnabled) {
        await sendEmailNotification(
          targetUserIds,
          `🛒 New Order: ${order.productName}`,
          `A new order is available: ${order.productName}\n\nDeadline: ${order.deadline ? new Date(order.deadline).toLocaleDateString() : 'TBD'}\n\nCheck the app to place your order.`
        );
      }

      console.log('✅ Order notification complete');
    } catch (error) {
      console.error('❌ Error sending order notification:', error);
    }
  });

  // ============================================================================
// WAITLIST NOTIFICATION SYSTEM
// ============================================================================

/**
 * Handle Accept/Decline response from push notification
 * Called when user taps action button on notification
 */
exports.handleAttendanceResponse = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const { eventId, response } = data;
  const userId = context.auth.uid;

  try {
    const eventRef = admin.firestore().collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Event not found');
    }

    const event = eventDoc.data();
    const responses = event.responses || {};

    // Check if user is in waiting status
    if (!responses[userId] || responses[userId].status !== 'waiting') {
      return { success: false, message: 'User not in waitlist' };
    }

    if (response === 'accept') {
      // Move user from waiting to attending
      responses[userId] = {
        status: 'attending',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        promotedFromWaitlist: true
      };

      await eventRef.update({ responses });
      await removePendingNotification(eventId, userId);
      await processWaitlistQueue(eventId);

      return { success: true, message: 'Confirmed attendance' };

    } else {
      // User declined
      responses[userId] = {
        status: 'declined',
        message: 'Declined from waitlist',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      await eventRef.update({ responses });
      await removePendingNotification(eventId, userId);
      await processWaitlistQueue(eventId);

      return { success: true, message: 'Declined attendance' };
    }

  } catch (error) {
    console.error('Error handling attendance response:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Process waitlist queue - notify users when spots available
 * Called after: cancel, decline, or accept
 */
async function processWaitlistQueue(eventId) {
  try {
    const eventRef = admin.firestore().collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) return;

    const event = eventDoc.data();
    
    console.log('═══════════════════════════════════════');
    console.log('📊 Processing waitlist queue for event:', eventId);
    console.log('📊 Event title:', event.title);
    console.log('📊 Participant limit:', event.participantLimit);
    
    if (!event.participantLimit) {
      console.log('⚠️ No participant limit set - queue processing skipped');
      return;
    }

    const responses = event.responses || {};

    // Get active attending users (not notified waitlist)
    const activeAttending = Object.entries(responses)
      .filter(([_, r]) => r.status === 'attending');
    
    const activeCount = activeAttending.length;
    console.log('📊 Active attending users:', activeCount);
    console.log('   Users:', activeAttending.map(([id]) => id).join(', '));

    // Get waiting users (sorted by timestamp)
    const waitingUsers = Object.entries(responses)
      .filter(([_, r]) => r.status === 'waiting')
      .sort((a, b) => (a[1].timestamp?._seconds || 0) - (b[1].timestamp?._seconds || 0));

    console.log('📊 Waiting users:', waitingUsers.length);
    console.log('   Users:', waitingUsers.map(([id]) => id).join(', '));

    const spotsAvailable = event.participantLimit - activeCount;
    console.log('📊 Spots available:', spotsAvailable, `(limit: ${event.participantLimit} - active: ${activeCount})`);

    if (spotsAvailable <= 0) {
      console.log('⚠️ No spots available - queue processing skipped');
      return;
    }
    
    if (waitingUsers.length === 0) {
      console.log('⚠️ No waiting users - queue processing skipped');
      return;
    }

    // Get pending notifications
    const pendingNotifications = await getPendingNotifications(eventId);
    const alreadyNotified = new Set(pendingNotifications.map(n => n.userId));
    
    console.log('📊 Already notified (pending response):', alreadyNotified.size);
    console.log('   Users:', Array.from(alreadyNotified).join(', '));

    // Notify users for available spots
    const usersToNotify = waitingUsers
      .filter(([userId]) => !alreadyNotified.has(userId))
      .slice(0, spotsAvailable);

    console.log('📊 Users to notify NOW:', usersToNotify.length);
    console.log('   Users:', usersToNotify.map(([id]) => id).join(', '));

    if (usersToNotify.length === 0) {
      console.log('⚠️ No new users to notify - all waitlisted users already notified');
      console.log('═══════════════════════════════════════');
      return;
    }

    for (const [userId, userData] of usersToNotify) {
      console.log(`🔔 Notifying user ${userId} about available spot`);
      await sendWaitlistNotification(eventId, userId, event);
      await createPendingNotification(eventId, userId);
      await scheduleTimeout(eventId, userId);
    }
    
    console.log('✅ Waitlist queue processing complete');
    console.log('═══════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error processing waitlist queue:', error);
    console.log('═══════════════════════════════════════');
  }
}

/**
 * Send push notification to waitlist user
 */
async function sendWaitlistNotification(eventId, userId, event) {
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const tokens = userData.fcmTokens || [];

    // Check user notification preferences
    const prefs = await getUserNotificationPreferences(userId);
    const shouldSendPush = shouldSendToUser(prefs, 'waitlist', 'push', event.clubId, event.teamId);
    
    console.log(`📱 User ${userId} push notification preference for waitlist: ${shouldSendPush}`);

    // Create in-app notification
    console.log(`💾 Creating in-app waitlist notification for user ${userId}`);
    try {
      await admin.firestore().collection('notifications').add({
        userId: userId,
        type: 'waitlist',
        title: '🎉 Spot Available!',
        body: `A spot opened up for ${event.title}. Accept within 5 minutes!`,
        data: {
          type: 'waitlist_promotion',
          eventId: eventId,
          requiresResponse: true,
          eventTitle: event.title,
          eventDate: event.date,
          eventTime: event.startTime || event.time
        },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
        clubId: event.clubId || null,
        teamId: event.teamId || null,
        eventId: eventId,
        actionUrl: `/event/${eventId}`
      });
    } catch (error) {
      console.error(`❌ Error creating in-app waitlist notification for user ${userId}:`, error);
    }

    // Send push notification only if user preferences allow
    if (shouldSendPush && tokens.length > 0) {
      console.log(`📲 About to send waitlist push notification:`);
      console.log(`   Target User ID: ${userId}`);
      console.log(`   User Email: ${userData.email}`);
      console.log(`   Number of tokens: ${tokens.length}`);
      console.log(`   Tokens: ${tokens.join(', ')}`);
      
      const message = {
        notification: {
          title: '🎉 Spot Available!',
          body: `A spot opened up for ${event.title}. Accept within 5 minutes!`
        },
        data: {
          type: 'waitlist_promotion',
          eventId: eventId,
          clubId: event.clubId || '',
          teamId: event.teamId || '',
          requiresResponse: 'true'
        },
        tokens: tokens
      };

      const result = await admin.messaging().sendEachForMulticast(message);
      console.log(`✅ Waitlist push notification sent to user ${userId}`);
      console.log(`   Success: ${result.successCount}, Failures: ${result.failureCount}`);
      
      // Log detailed error information for failures
      if (result.failureCount > 0) {
        console.log(`❌ Detailed failure information:`);
        result.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.log(`   Token ${idx} (${tokens[idx].substring(0, 20)}...): ${resp.error.code} - ${resp.error.message}`);
          }
        });
      }
    } else {
      console.log(`ℹ️ Push notification skipped for user ${userId} (prefs: ${shouldSendPush}, tokens: ${tokens.length})`);
    }

    const eventRef = admin.firestore().collection('events').doc(eventId);
    await eventRef.update({
      [`responses.${userId}.waitlistNotified`]: true,
      [`responses.${userId}.notifiedAt`]: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error('Error sending waitlist notification:', error);
  }
}

/**
 * Create pending notification record
 */
async function createPendingNotification(eventId, userId) {
  await admin.firestore().collection('pendingNotifications').add({
    eventId,
    userId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000) // 5 min
  });
}

/**
 * Remove pending notification
 */
async function removePendingNotification(eventId, userId) {
  const snapshot = await admin.firestore()
    .collection('pendingNotifications')
    .where('eventId', '==', eventId)
    .where('userId', '==', userId)
    .get();

  const batch = admin.firestore().batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

/**
 * Get pending notifications for event
 */
async function getPendingNotifications(eventId) {
  const snapshot = await admin.firestore()
    .collection('pendingNotifications')
    .where('eventId', '==', eventId)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Schedule 5-minute timeout using Firestore trigger
 */
async function scheduleTimeout(eventId, userId) {
  // Create a scheduled task document
  await admin.firestore().collection('scheduledTasks').add({
    type: 'waitlist_timeout',
    eventId,
    userId,
    scheduledFor: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
    status: 'pending'
  });
}

/**
 * Process scheduled tasks (runs every minute)
 */
exports.processScheduledTasks = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();

    const tasksSnapshot = await admin.firestore()
      .collection('scheduledTasks')
      .where('status', '==', 'pending')
      .where('scheduledFor', '<=', now)
      .get();

    for (const taskDoc of tasksSnapshot.docs) {
      const task = taskDoc.data();

      if (task.type === 'waitlist_timeout') {
        await handleWaitlistTimeout(task.eventId, task.userId);
      }

      // Mark as completed
      await taskDoc.ref.update({ status: 'completed' });
    }

    return null;
  });

/**
 * Handle timeout - user didn't respond in 5 minutes
 */
async function handleWaitlistTimeout(eventId, userId) {
  try {
    // Check if user already responded
    const pendingSnapshot = await admin.firestore()
      .collection('pendingNotifications')
      .where('eventId', '==', eventId)
      .where('userId', '==', userId)
      .get();

    if (pendingSnapshot.empty) {
      return; // User already responded
    }

    // Remove pending notification
    await removePendingNotification(eventId, userId);

    // Notify next person in queue
    await processWaitlistQueue(eventId);

    console.log(`⏰ Waitlist timeout for user ${userId} on event ${eventId}`);

  } catch (error) {
    console.error('Error handling waitlist timeout:', error);
  }
}

/**
 * Trigger when someone cancels attendance
 * Called from Event.jsx when user changes from attending to not attending
 */
exports.onAttendanceChange = functions.firestore
  .document('events/{eventId}')
  .onUpdate(async (change, context) => {
    const eventId = context.params.eventId;
    const before = change.before.data();
    const after = change.after.data();

    const beforeResponses = before.responses || {};
    const afterResponses = after.responses || {};

    // Check if someone cancelled (was attending, now not)
    const beforeAttending = Object.entries(beforeResponses)
      .filter(([_, r]) => r.status === 'attending')
      .map(([id]) => id);

    const afterAttending = Object.entries(afterResponses)
      .filter(([_, r]) => r.status === 'attending')
      .map(([id]) => id);

    const cancelled = beforeAttending.filter(id => !afterAttending.includes(id));

    if (cancelled.length > 0) {
      console.log(`🔔 ${cancelled.length} user(s) cancelled attendance on event ${eventId}`);
      // Process waitlist queue
      await processWaitlistQueue(eventId);
    }

    return null;
  });

// ============================================================================
// CHAT & USER MANAGEMENT NOTIFICATIONS (PHASE 3)
// ============================================================================

/**
 * Firestore Trigger: Send notification when new chat message is sent
 */
exports.onChatMessage = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const chatId = context.params.chatId;
    const messageId = context.params.messageId;
    
    console.log('💬 New message in chat:', chatId);

    try {
      // Get chat data to find members
      const chatDoc = await admin.firestore()
        .collection('chats')
        .doc(chatId)
        .get();
      
      if (!chatDoc.exists) {
        console.log('⚠️ Chat not found');
        return;
      }

      const chat = chatDoc.data();
      const senderId = message.senderId;
      
      // Notify all members except the sender
      let targetUserIds = (chat.members || []).filter(id => id !== senderId);

      if (targetUserIds.length === 0) {
        console.log('ℹ️ No users to notify');
        return;
      }

      console.log(`👥 Initial target users: ${targetUserIds.length}`);

      // Get sender name for notification
      const senderDoc = await admin.firestore()
        .collection('users')
        .doc(senderId)
        .get();
      
      const senderName = senderDoc.exists
        ? (senderDoc.data().displayName || senderDoc.data().username || senderDoc.data().email)
        : 'Someone';

      // Filter users by their notification preferences
      const filteredUsers = await filterUsersByPreferences(
        targetUserIds,
        'newChatMessage',
        chat.clubId,
        chat.teamId
      );

      // Prepare notification
      const messagePreview = message.text.length > 50 
        ? message.text.substring(0, 50) + '...'
        : message.text;

      // Create/update in-app notifications for ALL eligible users (grouped by chat)
      console.log(`💾 Creating/updating in-app notifications for ${filteredUsers.push.length + filteredUsers.email.length} users`);
      const allNotifiedUsers = new Set([...filteredUsers.push, ...filteredUsers.email]);
      
      for (const userId of allNotifiedUsers) {
        try {
          // Check if there's an existing unread notification for this chat
          const existingNotifs = await admin.firestore()
            .collection('notifications')
            .where('userId', '==', userId)
            .where('chatId', '==', chatId)
            .where('read', '==', false)
            .limit(1)
            .get();
          
          if (!existingNotifs.empty) {
            // Update existing notification with new count and latest message
            const existingDoc = existingNotifs.docs[0];
            const existingData = existingDoc.data();
            const currentCount = existingData.messageCount || 1;
            const newCount = currentCount + 1;
            
            await existingDoc.ref.update({
              body: `${newCount} new message${newCount > 1 ? 's' : ''}: ${messagePreview}`,
              messageCount: newCount,
              latestMessage: messagePreview,
              latestMessageId: messageId,
              latestSenderId: senderId,
              latestSenderName: senderName,
              createdAt: admin.firestore.FieldValue.serverTimestamp(), // Update to latest time
            });
            
            console.log(`✅ Updated existing notification for user ${userId} in chat ${chatId} (count: ${newCount})`);
          } else {
            // Create new notification
            await admin.firestore().collection('notifications').add({
              userId: userId,
              type: 'chat',
              title: `${senderName} • ${chat.title || 'Chat'}`,
              body: messagePreview,
              messageCount: 1,
              latestMessage: messagePreview,
              latestMessageId: messageId,
              latestSenderId: senderId,
              latestSenderName: senderName,
              data: {
                chatId: chatId,
                messageId: messageId,
                senderId: senderId,
                clubId: chat.clubId || '',
                teamId: chat.teamId || '',
                chatTitle: chat.title
              },
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
              clubId: chat.clubId || null,
              teamId: chat.teamId || null,
              chatId: chatId,
              actionUrl: `/chat/${chatId}`
            });
            
            console.log(`✅ Created new notification for user ${userId} in chat ${chatId}`);
          }
        } catch (error) {
          console.error(`❌ Error creating/updating in-app notification for user ${userId}:`, error);
        }
      }

      // Send push notifications to users who want them
      if (filteredUsers.push.length > 0) {
        const tokens = await getUserTokens(filteredUsers.push);

        if (tokens.length > 0) {
          console.log(`🔔 Sending push to ${tokens.length} devices`);

          const result = await sendMulticastNotification(
            tokens,
            {
              title: `${senderName} • ${chat.title || 'Chat'}`,
              body: messagePreview
            },
            {
              type: 'chat_message',
              chatId: chatId,
              messageId: messageId,
              senderId: senderId,
              clubId: chat.clubId || '',
              teamId: chat.teamId || ''
            }
          );

          // Clean up invalid tokens
          if (result.invalidTokens.length > 0) {
            await cleanupInvalidTokens(result.invalidTokens);
          }
        }
      }

      // Send email notifications to users who want them (usually disabled for chat)
      if (filteredUsers.email.length > 0) {
        await sendEmailNotification(
          filteredUsers.email,
          `💬 New message from ${senderName}`,
          `${senderName} sent a message in ${chat.title || 'chat'}:\n\n"${messagePreview}"\n\nCheck the app to reply.`,
          'newChatMessage',
          chat.clubId,
          chat.teamId
        );
      }

      console.log('✅ Chat notification complete');
    } catch (error) {
      console.error('❌ Error sending chat notification:', error);
    }
  });

/**
 * Callable Function: Notify user they were added to club/team
 */
exports.notifyUserAdded = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, clubId, clubName, teamId, teamName } = data;

  try {
    console.log(`➕ Notifying user ${userId} added to ${clubName}${teamName ? `/${teamName}` : ''}`);

    // Filter by user preferences
    const filteredUsers = await filterUsersByPreferences(
      [userId],
      'userAdded',
      clubId,
      teamId
    );

    const location = teamName ? `team "${teamName}"` : `club "${clubName}"`;
    
    // Create in-app notification for the user
    console.log(`💾 Creating in-app notification for user ${userId}`);
    const allNotifiedUsers = new Set([...filteredUsers.push, ...filteredUsers.email]);
    
    for (const notifyUserId of allNotifiedUsers) {
      try {
        await admin.firestore().collection('notifications').add({
          userId: notifyUserId,
          type: 'user_added',
          title: '🎉 You\'ve been added!',
          body: `You are now a member of ${location}`,
          data: {
            clubId: clubId,
            clubName: clubName,
            teamId: teamId || '',
            teamName: teamName || ''
          },
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
          clubId: clubId,
          teamId: teamId || null,
          actionUrl: teamId ? `/team/${teamId}` : `/club/${clubId}`
        });
      } catch (error) {
        console.error(`❌ Error creating in-app notification for user ${notifyUserId}:`, error);
      }
    }
    
    // Send push notification
    if (filteredUsers.push.length > 0) {
      const tokens = await getUserTokens(filteredUsers.push);

      if (tokens.length > 0) {
        const result = await sendMulticastNotification(
          tokens,
          {
            title: '🎉 You\'ve been added!',
            body: `You are now a member of ${location}`
          },
          {
            type: 'user_added',
            clubId: clubId,
            clubName: clubName,
            teamId: teamId || '',
            teamName: teamName || ''
          }
        );

        if (result.invalidTokens.length > 0) {
          await cleanupInvalidTokens(result.invalidTokens);
        }
      }
    }

    // Send email notification
    if (filteredUsers.email.length > 0) {
      await sendEmailNotification(
        filteredUsers.email,
        `🎉 Welcome to ${clubName}!`,
        `You have been added to ${location}.\n\nCheck the app to see team details and upcoming events.`,
        'userAdded',
        clubId,
        teamId
      );
    }

    console.log('✅ User added notification sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending user added notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Callable Function: Notify user they were removed from club/team
 */
exports.notifyUserRemoved = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, clubId, clubName, teamId, teamName } = data;

  try {
    console.log(`➖ Notifying user ${userId} removed from ${clubName}${teamName ? `/${teamName}` : ''}`);

    // Filter by user preferences
    const filteredUsers = await filterUsersByPreferences(
      [userId],
      'userRemoved',
      clubId,
      teamId
    );

    const location = teamName ? `team "${teamName}"` : `club "${clubName}"`;
    
    // Create in-app notification for the user
    console.log(`💾 Creating in-app notification for user ${userId}`);
    const allNotifiedUsers = new Set([...filteredUsers.push, ...filteredUsers.email]);
    
    for (const notifyUserId of allNotifiedUsers) {
      try {
        await admin.firestore().collection('notifications').add({
          userId: notifyUserId,
          type: 'user_removed',
          title: 'Membership Update',
          body: `You have been removed from ${location}`,
          data: {
            clubId: clubId,
            clubName: clubName,
            teamId: teamId || '',
            teamName: teamName || ''
          },
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
          clubId: clubId,
          teamId: teamId || null,
          actionUrl: null
        });
      } catch (error) {
        console.error(`❌ Error creating in-app notification for user ${notifyUserId}:`, error);
      }
    }
    
    // Send push notification
    if (filteredUsers.push.length > 0) {
      const tokens = await getUserTokens(filteredUsers.push);

      if (tokens.length > 0) {
        const result = await sendMulticastNotification(
          tokens,
          {
            title: 'Membership Update',
            body: `You have been removed from ${location}`
          },
          {
            type: 'user_removed',
            clubId: clubId,
            clubName: clubName,
            teamId: teamId || '',
            teamName: teamName || ''
          }
        );

        if (result.invalidTokens.length > 0) {
          await cleanupInvalidTokens(result.invalidTokens);
        }
      }
    }

    // Send email notification
    if (filteredUsers.email.length > 0) {
      await sendEmailNotification(
        filteredUsers.email,
        `Membership Update - ${clubName}`,
        `You have been removed from ${location}.\n\nIf you believe this is a mistake, please contact the club administrator.`,
        'userRemoved',
        clubId,
        teamId
      );
    }

    console.log('✅ User removed notification sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending user removed notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Callable Function: Notify user their role was changed
 */
exports.notifyRoleChanged = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, clubId, clubName, newRole, oldRole } = data;

  try {
    console.log(`⭐ Notifying user ${userId} role changed from ${oldRole} to ${newRole}`);

    // Filter by user preferences
    const filteredUsers = await filterUsersByPreferences(
      [userId],
      'roleChanged',
      clubId,
      null
    );

    const roleNames = {
      'trainer': 'Trainer',
      'assistant': 'Assistant',
      'user': 'Member',
      'parent': 'Parent'
    };

    const newRoleName = roleNames[newRole] || newRole;
    const oldRoleName = roleNames[oldRole] || oldRole;
    
    // Create in-app notification for the user
    console.log(`💾 Creating in-app notification for user ${userId}`);
    const allNotifiedUsers = new Set([...filteredUsers.push, ...filteredUsers.email]);
    
    for (const notifyUserId of allNotifiedUsers) {
      try {
        await admin.firestore().collection('notifications').add({
          userId: notifyUserId,
          type: 'role_changed',
          title: '⭐ Role Updated!',
          body: `You are now a ${newRoleName} in ${clubName}`,
          data: {
            clubId: clubId,
            clubName: clubName,
            newRole: newRole,
            oldRole: oldRole,
            newRoleName: newRoleName,
            oldRoleName: oldRoleName
          },
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
          clubId: clubId,
          teamId: null,
          actionUrl: `/club/${clubId}`
        });
      } catch (error) {
        console.error(`❌ Error creating in-app notification for user ${notifyUserId}:`, error);
      }
    }
    
    // Send push notification
    if (filteredUsers.push.length > 0) {
      const tokens = await getUserTokens(filteredUsers.push);

      if (tokens.length > 0) {
        const result = await sendMulticastNotification(
          tokens,
          {
            title: '⭐ Role Updated!',
            body: `You are now a ${newRoleName} in ${clubName}`
          },
          {
            type: 'role_changed',
            clubId: clubId,
            clubName: clubName,
            newRole: newRole,
            oldRole: oldRole
          }
        );

        if (result.invalidTokens.length > 0) {
          await cleanupInvalidTokens(result.invalidTokens);
        }
      }
    }

    // Send email notification
    if (filteredUsers.email.length > 0) {
      await sendEmailNotification(
        filteredUsers.email,
        `⭐ Your role has been updated in ${clubName}`,
        `Your role in ${clubName} has been changed from ${oldRoleName} to ${newRoleName}.\n\nCheck the app to see your new permissions and responsibilities.`,
        'roleChanged',
        clubId,
        null
      );
    }

    console.log('✅ Role changed notification sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending role changed notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================================================
// EVENT REMINDERS (PHASE 2)
// ============================================================================

/**
 * Schedule reminders when event is created/updated
 * Triggered by onEventCreated and onEventUpdated
 */
async function scheduleEventReminders(eventId, eventData) {
  try {
    console.log(`📅 Scheduling reminders for event ${eventId}`);
    
    const reminders = eventData.reminders || [];
    if (reminders.length === 0) {
      console.log('ℹ️ No reminders configured for this event');
      return;
    }

    // Calculate event start time
    const eventDate = new Date(eventData.date);
    // Support both new (startTime) and old (time) field names
    const timeField = eventData.startTime || eventData.time;
    if (timeField) {
      const [hours, minutes] = timeField.split(':');
      eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    const eventStartTime = eventDate.getTime();
    const now = Date.now();

    console.log(`⏰ Event start time: ${new Date(eventStartTime).toISOString()}`);
    console.log(`⏰ Current time: ${new Date(now).toISOString()}`);

    // Schedule each reminder
    for (const reminder of reminders) {
      const reminderTime = eventStartTime - (reminder.minutesBefore * 60 * 1000);
      
      // Only schedule if reminder time is in the future
      if (reminderTime > now) {
        await admin.firestore()
          .collection('scheduledReminders')
          .add({
            eventId: eventId,
            eventTitle: eventData.title,
            eventDate: eventData.date,
            eventTime: timeField || null,
            clubId: eventData.clubId || null,
            teamId: eventData.teamId || null,
            minutesBefore: reminder.minutesBefore,
            channels: reminder.channels,
            scheduledFor: new Date(reminderTime),
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        
        console.log(`✅ Scheduled reminder ${reminder.minutesBefore}min before event at ${new Date(reminderTime).toISOString()}`);
      } else {
        console.log(`⏭️ Skipped reminder ${reminder.minutesBefore}min (time passed)`);
      }
    }

    console.log(`✅ All reminders scheduled for event ${eventId}`);
  } catch (error) {
    console.error('❌ Error scheduling reminders:', error);
  }
}

/**
 * Scheduled function to check and send pending reminders
 * Runs every minute
 */
exports.processEventReminders = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    console.log('🔔 Processing event reminders...');
    
    try {
      const now = admin.firestore.Timestamp.now();
      
      // Get all pending reminders that are due
      const remindersSnapshot = await admin.firestore()
        .collection('scheduledReminders')
        .where('status', '==', 'pending')
        .where('scheduledFor', '<=', now.toDate())
        .limit(50) // Process 50 at a time
        .get();

      if (remindersSnapshot.empty) {
        console.log('ℹ️ No pending reminders to process');
        return null;
      }

      console.log(`📊 Found ${remindersSnapshot.size} reminders to send`);

      // Process each reminder
      const promises = remindersSnapshot.docs.map(async (doc) => {
        const reminder = doc.data();
        
        try {
          // Get event details
          const eventDoc = await admin.firestore()
            .doc(`events/${reminder.eventId}`)
            .get();

          if (!eventDoc.exists) {
            console.log(`⚠️ Event ${reminder.eventId} not found, marking reminder as cancelled`);
            await doc.ref.update({ status: 'cancelled' });
            return;
          }

          const event = eventDoc.data();
          
          // Get attendees (users with status 'attending' or 'maybe')
          const responses = event.responses || {};
          const attendeeIds = Object.entries(responses)
            .filter(([_, response]) => 
              response.status === 'attending' || response.status === 'maybe'
            )
            .map(([userId]) => userId);

          if (attendeeIds.length === 0) {
            console.log(`ℹ️ No attendees for event ${reminder.eventId}`);
            await doc.ref.update({ status: 'completed', sentAt: admin.firestore.FieldValue.serverTimestamp() });
            return;
          }

          console.log(`👥 Sending reminder to ${attendeeIds.length} attendees`);

          // Filter users by preferences
          const filteredUsers = await filterUsersByPreferences(
            attendeeIds,
            'eventReminder',
            reminder.clubId,
            reminder.teamId
          );

          // Format time display
          const hours = Math.floor(reminder.minutesBefore / 60);
          const minutes = reminder.minutesBefore % 60;
          const timeText = hours > 0 
            ? `${hours} hour${hours > 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} min` : ''}`
            : `${minutes} minute${minutes > 1 ? 's' : ''}`;

          // Create in-app notifications for all attendees
          console.log(`💾 Creating in-app reminder notifications for ${filteredUsers.push.length + filteredUsers.email.length} users`);
          const allNotifiedUsers = new Set([...filteredUsers.push, ...filteredUsers.email]);
          
          for (const userId of allNotifiedUsers) {
            try {
              await admin.firestore().collection('notifications').add({
                userId: userId,
                type: 'reminder',
                title: `⏰ Reminder: ${reminder.eventTitle}`,
                body: `Event starts in ${timeText}`,
                data: {
                  type: 'event_reminder',
                  eventId: reminder.eventId,
                  clubId: reminder.clubId || '',
                  teamId: reminder.teamId || '',
                  eventTitle: reminder.eventTitle,
                  eventDate: reminder.eventDate,
                  eventTime: reminder.eventTime,
                  minutesBefore: reminder.minutesBefore
                },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
                clubId: reminder.clubId || null,
                teamId: reminder.teamId || null,
                eventId: reminder.eventId,
                actionUrl: `/event/${reminder.eventId}`
              });
            } catch (error) {
              console.error(`❌ Error creating in-app reminder notification for user ${userId}:`, error);
            }
          }

          // Send push notifications
          if (reminder.channels.push && filteredUsers.push.length > 0) {
            const tokens = await getUserTokens(filteredUsers.push);
            
            if (tokens.length > 0) {
              const result = await sendMulticastNotification(
                tokens,
                {
                  title: `⏰ Reminder: ${reminder.eventTitle}`,
                  body: `Event starts in ${timeText}`
                },
                {
                  type: 'event_reminder',
                  eventId: reminder.eventId,
                  clubId: reminder.clubId || '',
                  teamId: reminder.teamId || ''
                }
              );

              if (result.invalidTokens.length > 0) {
                await cleanupInvalidTokens(result.invalidTokens);
              }

              console.log(`✅ Sent push reminders to ${tokens.length} devices`);
            }
          }

          // Send email notifications
          if (reminder.channels.email && filteredUsers.email.length > 0) {
            await sendEmailNotification(
              filteredUsers.email,
              `⏰ Reminder: ${reminder.eventTitle}`,
              `This is a reminder that "${reminder.eventTitle}" starts in ${timeText}.\n\nDate: ${reminder.eventDate}\nTime: ${reminder.eventTime || 'Not specified'}\n\nSee you there!`,
              'eventReminder',
              reminder.clubId,
              reminder.teamId
            );

            console.log(`✅ Sent email reminders to ${filteredUsers.email.length} users`);
          }

          // Mark as completed
          await doc.ref.update({
            status: 'completed',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            recipientCount: attendeeIds.length
          });

          console.log(`✅ Reminder ${doc.id} completed`);
        } catch (error) {
          console.error(`❌ Error processing reminder ${doc.id}:`, error);
          await doc.ref.update({
            status: 'failed',
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      });

      await Promise.all(promises);
      console.log('✅ Reminder processing complete');
      return null;
    } catch (error) {
      console.error('❌ Error in processEventReminders:', error);
      return null;
    }
  });

/**
 * Cancel reminders when event is deleted
 */
async function cancelEventReminders(eventId) {
  try {
    console.log(`🗑️ Cancelling reminders for event ${eventId}`);
    
    const remindersSnapshot = await admin.firestore()
      .collection('scheduledReminders')
      .where('eventId', '==', eventId)
      .where('status', '==', 'pending')
      .get();

    if (remindersSnapshot.empty) {
      console.log('ℹ️ No pending reminders to cancel');
      return;
    }

    const batch = admin.firestore().batch();
    remindersSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'cancelled' });
    });

    await batch.commit();
    console.log(`✅ Cancelled ${remindersSnapshot.size} reminders`);
  } catch (error) {
    console.error('❌ Error cancelling reminders:', error);
  }
}

// ============================================================================
// LOCK PERIOD NOTIFICATIONS (PHASE 4B)
// ============================================================================

/**
 * Schedule lock notification when event is created/updated
 */
async function scheduleLockNotification(eventId, eventData) {
  try {
    if (!eventData.lockPeriod || !eventData.lockPeriod.enabled || !eventData.lockPeriod.notifyOnLock) {
      console.log('ℹ️ Lock notification not configured for this event');
      return;
    }

    console.log(`🔒 Scheduling lock notification for event ${eventId}`);

    // Calculate event start time
    const eventDate = new Date(eventData.date);
    // Support both new (startTime) and old (time) field names
    const timeField = eventData.startTime || eventData.time;
    if (timeField) {
      const [hours, minutes] = timeField.split(':');
      eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    const eventStartTime = eventDate.getTime();
    const lockTime = eventStartTime - (eventData.lockPeriod.minutesBefore * 60 * 1000);
    const now = Date.now();

    console.log(`⏰ Event start time: ${new Date(eventStartTime).toISOString()}`);
    console.log(`⏰ Lock time: ${new Date(lockTime).toISOString()}`);
    console.log(`⏰ Current time: ${new Date(now).toISOString()}`);

    // Only schedule if lock time is in the future
    if (lockTime > now) {
      await admin.firestore()
        .collection('scheduledLockNotifications')
        .add({
          eventId: eventId,
          eventTitle: eventData.title,
          eventDate: eventData.date,
          eventTime: timeField || null,
          clubId: eventData.clubId || null,
          teamId: eventData.teamId || null,
          lockMinutesBefore: eventData.lockPeriod.minutesBefore,
          scheduledFor: new Date(lockTime),
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      
      console.log(`✅ Scheduled lock notification for event ${eventId} at ${new Date(lockTime).toISOString()}`);
    } else {
      console.log(`⏭️ Skipped lock notification (time passed)`);
    }
  } catch (error) {
    console.error('❌ Error scheduling lock notification:', error);
  }
}

/**
 * Scheduled function to send lock notifications
 * Runs every minute
 */
exports.processLockNotifications = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    console.log('🔒 Processing lock notifications...');
    
    try {
      const now = admin.firestore.Timestamp.now();
      
      // Get all pending lock notifications that are due
      const notificationsSnapshot = await admin.firestore()
        .collection('scheduledLockNotifications')
        .where('status', '==', 'pending')
        .where('scheduledFor', '<=', now.toDate())
        .limit(50)
        .get();

      if (notificationsSnapshot.empty) {
        console.log('ℹ️ No pending lock notifications');
        return null;
      }

      console.log(`📊 Found ${notificationsSnapshot.size} lock notifications to send`);

      // Process each notification
      const promises = notificationsSnapshot.docs.map(async (doc) => {
        const notification = doc.data();
        
        try {
          // Get event details
          const eventDoc = await admin.firestore()
            .doc(`events/${notification.eventId}`)
            .get();

          if (!eventDoc.exists) {
            console.log(`⚠️ Event ${notification.eventId} not found`);
            await doc.ref.update({ status: 'cancelled' });
            return;
          }

          const event = eventDoc.data();
          
          // Get all attendees and waitlist
          const responses = event.responses || {};
          const targetUserIds = Object.entries(responses)
            .filter(([_, response]) => 
              response.status === 'attending' || 
              response.status === 'maybe' ||
              response.status === 'waiting'
            )
            .map(([userId]) => userId);

          if (targetUserIds.length === 0) {
            console.log(`ℹ️ No attendees for event ${notification.eventId}`);
            await doc.ref.update({ status: 'completed', sentAt: admin.firestore.FieldValue.serverTimestamp() });
            return;
          }

          console.log(`👥 Sending lock notification to ${targetUserIds.length} users`);

          // Filter by preferences (use 'eventReminder' type for lock notifications)
          const filteredUsers = await filterUsersByPreferences(
            targetUserIds,
            'eventReminder',
            notification.clubId,
            notification.teamId
          );

          // Format time display
          const hours = Math.floor(notification.lockMinutesBefore / 60);
          const minutes = notification.lockMinutesBefore % 60;
          const timeText = hours > 0 
            ? `${hours} hour${hours > 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} min` : ''}`
            : `${minutes} minute${minutes > 1 ? 's' : ''}`;

          // Create in-app notifications for all attendees
          console.log(`💾 Creating in-app lock notifications for ${filteredUsers.push.length + filteredUsers.email.length} users`);
          const allNotifiedUsers = new Set([...filteredUsers.push, ...filteredUsers.email]);
          
          for (const userId of allNotifiedUsers) {
            try {
              await admin.firestore().collection('notifications').add({
                userId: userId,
                type: 'event_lock',
                title: `🔒 ${notification.eventTitle} is now locked`,
                body: `Status changes are no longer allowed`,
                data: {
                  type: 'event_locked',
                  eventId: notification.eventId,
                  clubId: notification.clubId || '',
                  teamId: notification.teamId || '',
                  eventTitle: notification.eventTitle,
                  eventDate: notification.eventDate,
                  eventTime: notification.eventTime,
                  lockMinutesBefore: notification.lockMinutesBefore
                },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
                clubId: notification.clubId || null,
                teamId: notification.teamId || null,
                eventId: notification.eventId,
                actionUrl: `/event/${notification.eventId}`
              });
            } catch (error) {
              console.error(`❌ Error creating in-app lock notification for user ${userId}:`, error);
            }
          }

          // Send push notifications
          if (filteredUsers.push.length > 0) {
            const tokens = await getUserTokens(filteredUsers.push);
            
            if (tokens.length > 0) {
              const result = await sendMulticastNotification(
                tokens,
                {
                  title: `🔒 ${notification.eventTitle} is now locked`,
                  body: `Status changes are no longer allowed`
                },
                {
                  type: 'event_locked',
                  eventId: notification.eventId,
                  clubId: notification.clubId || '',
                  teamId: notification.teamId || ''
                }
              );

              if (result.invalidTokens.length > 0) {
                await cleanupInvalidTokens(result.invalidTokens);
              }

              console.log(`✅ Sent push lock notifications to ${tokens.length} devices`);
            }
          }

          // Send email notifications
          if (filteredUsers.email.length > 0) {
            await sendEmailNotification(
              filteredUsers.email,
              `🔒 Event Locked: ${notification.eventTitle}`,
              `The event "${notification.eventTitle}" is now locked.\n\nStatus changes are no longer allowed. If you need to make changes, please contact the event organizer.\n\nDate: ${notification.eventDate}\nTime: ${notification.eventTime || 'Not specified'}`,
              'eventReminder',
              notification.clubId,
              notification.teamId
            );

            console.log(`✅ Sent email lock notifications to ${filteredUsers.email.length} users`);
          }

          // Mark as completed
          await doc.ref.update({
            status: 'completed',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            recipientCount: targetUserIds.length
          });

          console.log(`✅ Lock notification ${doc.id} completed`);
        } catch (error) {
          console.error(`❌ Error processing lock notification ${doc.id}:`, error);
          await doc.ref.update({
            status: 'failed',
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      });

      await Promise.all(promises);
      console.log('✅ Lock notification processing complete');
      return null;
    } catch (error) {
      console.error('❌ Error in processLockNotifications:', error);
      return null;
    }
  });

/**
 * Cancel lock notification when event is deleted
 */
async function cancelLockNotification(eventId) {
  try {
    console.log(`🗑️ Cancelling lock notification for event ${eventId}`);
    
    const notificationsSnapshot = await admin.firestore()
      .collection('scheduledLockNotifications')
      .where('eventId', '==', eventId)
      .where('status', '==', 'pending')
      .get();

    if (notificationsSnapshot.empty) {
      console.log('ℹ️ No pending lock notifications to cancel');
      return;
    }

    const batch = admin.firestore().batch();
    notificationsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'cancelled' });
    });

    await batch.commit();
    console.log(`✅ Cancelled ${notificationsSnapshot.size} lock notifications`);
  } catch (error) {
    console.error('❌ Error cancelling lock notifications:', error);
  }
}

// ============================================================================
// PHASE 4A: SUBSTITUTION SYSTEM
// ============================================================================

/**
 * Request a substitute for an event
 * Handles:
 * - Auto-accept if substitute is from waitlist
 * - Requires confirmation if substitute is from outside waitlist
 */
exports.requestSubstitute = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { eventId, originalUserId, substituteUserId, fromWaitlist } = data;
  console.log(`🔄 Substitution request: ${originalUserId} → ${substituteUserId} for event ${eventId}`);

  try {
    const eventRef = admin.firestore().doc(`events/${eventId}`);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Event not found');
    }

    const event = eventDoc.data();
    const responses = event.responses || {};

    // Verify original user is in active list
    if (responses[originalUserId]?.status !== 'attending') {
      throw new functions.https.HttpsError('failed-precondition', 'Original user is not in active list');
    }

    // Check if substitute is available
    const substituteResponse = responses[substituteUserId];
    if (substituteResponse && substituteResponse.status === 'attending') {
      throw new functions.https.HttpsError('failed-precondition', 'Substitute is already attending');
    }

    // Get user data
    const [originalUser, substituteUser] = await Promise.all([
      admin.firestore().doc(`users/${originalUserId}`).get(),
      admin.firestore().doc(`users/${substituteUserId}`).get()
    ]);

    // **CASE 1: Substitute from WAITLIST** - Auto-accept
    if (fromWaitlist && substituteResponse?.status === 'waitlist') {
      console.log('✅ Auto-accepting substitute from waitlist');

      // Update event: swap users
      const updatedResponses = { ...responses };
      updatedResponses[originalUserId] = {
        ...updatedResponses[originalUserId],
        status: 'waitlist', // Move original to waitlist
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      updatedResponses[substituteUserId] = {
        status: 'attending', // Move substitute to active
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        message: 'Substituted from waitlist'
      };

      await eventRef.update({ responses: updatedResponses });

      // Notify both users
      await Promise.all([
        // Notify original user
        sendPushNotification(
          originalUserId,
          '✅ Substitution Completed',
          `${substituteUser.data().username} has taken your spot for "${event.title}"`,
          {
            type: 'substitution',
            eventId: eventId,
            clubId: event.clubId,
            teamId: event.teamId,
            actionUrl: `/event/${eventId}`
          }
        ),
        // Notify substitute
        sendPushNotification(
          substituteUserId,
          '🎉 You\'re In!',
          `You've been moved to the active list for "${event.title}"`,
          {
            type: 'substitution',
            eventId: eventId,
            clubId: event.clubId,
            teamId: event.teamId,
            actionUrl: `/event/${eventId}`
          }
        )
      ]);

      return { success: true, message: 'Substitution completed automatically', autoAccepted: true };
    }

    // **CASE 2: Substitute from OUTSIDE WAITLIST** - Requires confirmation
    console.log('📨 Creating substitution request (requires confirmation)');

    // Create substitution request
    const substitutionRef = admin.firestore().collection('substitutionRequests').doc();
    await substitutionRef.set({
      id: substitutionRef.id,
      eventId,
      eventTitle: event.title,
      originalUserId,
      originalUserName: originalUser.data().username,
      substituteUserId,
      substituteUserName: substituteUser.data().username,
      status: 'pending', // pending, accepted, rejected, expired
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000), // 5 minutes
      fromWaitlist: false
    });

    // Notify substitute
    console.log(`📲 Sending substitution request notification:`);
    console.log(`   Original User: ${originalUserId} (${originalUser.data().email})`);
    console.log(`   Substitute User: ${substituteUserId} (${substituteUser.data().email})`);
    console.log(`   Event: ${event.title} (${eventId})`);
    
    await sendPushNotification(
      substituteUserId,
      '🔄 Substitution Request',
      `${originalUser.data().username} requests you as substitute for "${event.title}". You have 5 minutes to respond.`,
      {
        type: 'substitution',
        eventId: eventId,
        clubId: event.clubId,
        teamId: event.teamId,
        actionUrl: `/event/${eventId}`
      }
    );

    return { 
      success: true, 
      message: 'Substitution request sent. Waiting for confirmation.', 
      substitutionId: substitutionRef.id,
      autoAccepted: false
    };

  } catch (error) {
    console.error('❌ Error in requestSubstitute:', error);
    throw error;
  }
});

/**
 * Respond to a substitution request (accept/reject)
 */
exports.respondToSubstitution = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { substitutionId, action } = data; // action: 'accept' or 'reject'
  console.log(`💬 Substitution response: ${action} for ${substitutionId}`);

  try {
    const requestRef = admin.firestore().doc(`substitutionRequests/${substitutionId}`);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Substitution request not found');
    }

    const request = requestDoc.data();

    // Check if request is still pending
    if (request.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Request already processed');
    }

    // Check if expired
    if (request.expiresAt.toMillis() < Date.now()) {
      await requestRef.update({ status: 'expired' });
      throw new functions.https.HttpsError('deadline-exceeded', 'Request has expired');
    }

    // **ACCEPT**
    if (action === 'accept') {
      console.log('✅ Substitution accepted');

      // Update event: swap users
      const eventRef = admin.firestore().doc(`events/${request.eventId}`);
      const eventDoc = await eventRef.get();
      const event = eventDoc.data();
      const responses = event.responses || {};

      const updatedResponses = { ...responses };
      
      // ✅ FIX: Check if substitute was from waitlist - if so, SWAP them
      const substituteWasInWaitlist = responses[request.substituteUserId]?.status === 'waitlist';
      
      if (substituteWasInWaitlist) {
        // SWAP: Original goes to waitlist, Substitute goes to active
        updatedResponses[request.originalUserId] = {
          ...updatedResponses[request.originalUserId],
          status: 'waitlist',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          message: 'Swapped with substitute from waitlist'
        };
        updatedResponses[request.substituteUserId] = {
          status: 'attending',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          message: 'Substituted from waitlist for ' + request.originalUserName
        };
      } else {
        // Normal substitution: Original declines, Substitute attends
        updatedResponses[request.originalUserId] = {
          ...updatedResponses[request.originalUserId],
          status: 'declined',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          message: 'Found substitute'
        };
        updatedResponses[request.substituteUserId] = {
          status: 'attending',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          message: 'Substituted for ' + request.originalUserName
        };
      }

      await eventRef.update({ responses: updatedResponses });
      await requestRef.update({ status: 'accepted' });

      // Notify original user
      await sendPushNotification(
        request.originalUserId,
        '✅ Substitution Confirmed',
        `${request.substituteUserName} has accepted to substitute you for "${request.eventTitle}"`,
        {
          type: 'substitution',
          eventId: request.eventId,
          clubId: request.clubId,
          teamId: request.teamId,
          actionUrl: `/event/${request.eventId}`
        }
      );

      return { success: true, message: 'Substitution accepted' };
    }

    // **REJECT**
    if (action === 'reject') {
      console.log('❌ Substitution rejected');

      await requestRef.update({ status: 'rejected' });

      // Notify original user
      await sendPushNotification(
        request.originalUserId,
        '❌ Substitution Declined',
        `${request.substituteUserName} declined the substitution request for "${request.eventTitle}"`,
        {
          type: 'substitution',
          eventId: request.eventId,
          clubId: request.clubId,
          teamId: request.teamId,
          actionUrl: `/event/${request.eventId}`
        }
      );

      return { success: true, message: 'Substitution rejected' };
    }

    throw new functions.https.HttpsError('invalid-argument', 'Invalid action');

  } catch (error) {
    console.error('❌ Error in respondToSubstitution:', error);
    throw error;
  }
});

/**
 * Trainer manually swaps users between active list and waitlist
 * Can be used even during lock period
 */
exports.trainerSwapUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { eventId, user1Id, user2Id } = data;
  console.log(`👨‍🏫 Trainer swap: ${user1Id} ↔ ${user2Id} for event ${eventId}`);

  try {
    // Verify caller is trainer/admin
    const callerUid = context.auth.uid;
    const eventRef = admin.firestore().doc(`events/${eventId}`);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Event not found');
    }

    const event = eventDoc.data();

    // Check if caller is trainer, club owner, or admin
    const callerDoc = await admin.firestore().doc(`users/${callerUid}`).get();
    const callerData = callerDoc.data();
    const isAdmin = callerData.isSuperAdmin || callerData.role === 'admin';

    if (!isAdmin && event.clubId) {
      const clubDoc = await admin.firestore().doc(`clubs/${event.clubId}`).get();
      const club = clubDoc.data();
      const isTrainer = (club.trainers || []).includes(callerUid);
      const isOwner = club.createdBy === callerUid || (club.trainers || []).includes(callerUid);

      if (!isTrainer && !isOwner) {
        throw new functions.https.HttpsError('permission-denied', 'Only trainers can swap users');
      }
    }

    // Swap the users
    const responses = event.responses || {};
    const user1Response = responses[user1Id];
    const user2Response = responses[user2Id];

    if (!user1Response || !user2Response) {
      throw new functions.https.HttpsError('failed-precondition', 'Both users must have responses');
    }

    // Swap statuses
    const updatedResponses = { ...responses };
    const temp = updatedResponses[user1Id].status;
    updatedResponses[user1Id] = {
      ...updatedResponses[user1Id],
      status: updatedResponses[user2Id].status,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message: 'Swapped by trainer'
    };
    updatedResponses[user2Id] = {
      ...updatedResponses[user2Id],
      status: temp,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message: 'Swapped by trainer'
    };

    await eventRef.update({ responses: updatedResponses });

    // Get user data for notifications
    const [user1Doc, user2Doc] = await Promise.all([
      admin.firestore().doc(`users/${user1Id}`).get(),
      admin.firestore().doc(`users/${user2Id}`).get()
    ]);

    // Notify both users
    await Promise.all([
      sendPushNotification(
        user1Id,
        '🔄 Status Changed',
        `A trainer has updated your status for "${event.title}"`,
        {
          type: 'trainer_action',
          eventId: eventId,
          clubId: event.clubId,
          teamId: event.teamId,
          actionUrl: `/event/${eventId}`
        }
      ),
      sendPushNotification(
        user2Id,
        '🔄 Status Changed',
        `A trainer has updated your status for "${event.title}"`,
        {
          type: 'trainer_action',
          eventId: eventId,
          clubId: event.clubId,
          teamId: event.teamId,
          actionUrl: `/event/${eventId}`
        }
      )
    ]);

    return { success: true, message: 'Users swapped successfully' };

  } catch (error) {
    console.error('❌ Error in trainerSwapUsers:', error);
    throw error;
  }
});

/**
 * Get pending substitution requests for a user
 */
exports.getPendingSubstitutions = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId } = data;

  try {
    const snapshot = await admin.firestore()
      .collection('substitutionRequests')
      .where('substituteUserId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    const substitutions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { substitutions };
  } catch (error) {
    console.error('❌ Error getting pending substitutions:', error);
    throw error;
  }
});

/**
 * Delete a specific substitution request (manual deletion by user)
 */
exports.deleteSubstitutionRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { requestId } = data;
  const userId = context.auth.uid;

  if (!requestId) {
    throw new functions.https.HttpsError('invalid-argument', 'Request ID is required');
  }

  try {
    console.log(`🗑️ Deleting substitution request ${requestId} by user ${userId}`);

    const requestRef = admin.firestore().collection('substitutionRequests').doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Substitution request not found');
    }

    const request = requestDoc.data();

    // Check if user is authorized to delete (requester, substitute, or admin)
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const isAdmin = userDoc.data()?.role === 'admin';
    const isRequester = request.requesterId === userId;
    const isSubstitute = request.substituteUserId === userId;

    if (!isAdmin && !isRequester && !isSubstitute) {
      throw new functions.https.HttpsError('permission-denied', 'You do not have permission to delete this request');
    }

    // Delete the request
    await requestRef.delete();

    console.log(`✅ Successfully deleted substitution request ${requestId}`);

    return { success: true, message: 'Substitution request deleted' };
  } catch (error) {
    console.error('❌ Error deleting substitution request:', error);
    throw error;
  }
});

/**
 * Clean up expired and old substitution requests (runs every 5 minutes)
 * - Marks expired requests as 'expired'
 * - Deletes all but the 20 newest substitution requests
 */
exports.cleanupExpiredSubstitutions = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    try {
      console.log('🧹 Cleaning up substitution requests');

      // Step 1: Mark expired pending requests as 'expired'
      const now = admin.firestore.Timestamp.now();
      const expiredSnapshot = await admin.firestore()
        .collection('substitutionRequests')
        .where('status', '==', 'pending')
        .where('expiresAt', '<', now)
        .get();

      if (!expiredSnapshot.empty) {
        const batch1 = admin.firestore().batch();
        expiredSnapshot.docs.forEach(doc => {
          batch1.update(doc.ref, { status: 'expired' });
        });
        await batch1.commit();
        console.log(`✅ Marked ${expiredSnapshot.size} requests as expired`);
      }

      // Step 2: Keep only the 20 newest substitution requests
      const allRequests = await admin.firestore()
        .collection('substitutionRequests')
        .orderBy('createdAt', 'desc')
        .get();

      if (allRequests.size > 20) {
        const toDelete = allRequests.docs.slice(20); // Keep first 20, delete the rest
        const batch2 = admin.firestore().batch();
        
        toDelete.forEach(doc => {
          batch2.delete(doc.ref);
        });

        await batch2.commit();
        console.log(`🗑️ Deleted ${toDelete.length} old substitution requests (keeping 20 newest)`);
      } else {
        console.log(`ℹ️ Total requests: ${allRequests.size}, no deletion needed (limit: 20)`);
      }

      return null;
    } catch (error) {
      console.error('❌ Error cleaning up substitutions:', error);
      return null;
    }
  });

// ============================================================================
// IN-APP NOTIFICATION CLEANUP
// ============================================================================

/**
 * Clean up expired in-app notifications (older than 7 days)
 * Runs daily at midnight
 */
exports.cleanupExpiredNotifications = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight
  .timeZone('Europe/Bratislava')
  .onRun(async (context) => {
    try {
      console.log('🧹 Starting notification cleanup...');
      
      const now = admin.firestore.Timestamp.now();
      const snapshot = await admin.firestore()
        .collection('notifications')
        .where('expiresAt', '<', now)
        .get();
      
      if (snapshot.empty) {
        console.log('✅ No expired notifications to clean up');
        return null;
      }
      
      // Batch delete (max 500 per batch)
      const batches = [];
      let batch = admin.firestore().batch();
      let count = 0;
      
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
        
        if (count === 500) {
          batches.push(batch);
          batch = admin.firestore().batch();
          count = 0;
        }
      });
      
      if (count > 0) {
        batches.push(batch);
      }
      
      await Promise.all(batches.map(b => b.commit()));
      
      console.log(`✅ Deleted ${snapshot.docs.length} expired notifications`);
      return null;
    } catch (error) {
      console.error('❌ Error cleaning up notifications:', error);
      return null;
    }
  });

/**
 * Clean up all invalid FCM tokens from all users
 * Callable function that can be triggered manually by admins
 */
exports.cleanupAllInvalidTokens = functions.https.onCall(async (data, context) => {
  // Only allow admins to call this
  if (!context.auth || !context.auth.token.role || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can clean up tokens'
    );
  }

  console.log('🧹 Starting cleanup of ALL invalid FCM tokens...');
  
  try {
    const usersSnapshot = await admin.firestore().collection('users').get();
    
    let totalUsers = 0;
    let totalCleaned = 0;
    let totalInvalidTokens = 0;
    
    const batches = [];
    let batch = admin.firestore().batch();
    let batchCount = 0;
    const MAX_BATCH = 500;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const tokens = userData.fcmTokens || [];
      
      if (tokens.length === 0) continue;
      
      totalUsers++;
      
      // Filter out invalid tokens (empty, non-string, too short, or array notation)
      const validTokens = tokens.filter(token => 
        token && 
        typeof token === 'string' && 
        token.length > 10 &&
        !token.includes('[') && // Remove array strings like "[]"
        !token.includes(']')
      );
      
      const invalidCount = tokens.length - validTokens.length;
      
      if (invalidCount > 0) {
        console.log(`👤 User ${userData.email}: ${tokens.length} tokens → ${validTokens.length} valid (removed ${invalidCount})`);
        
        batch.update(userDoc.ref, { fcmTokens: validTokens });
        totalCleaned++;
        totalInvalidTokens += invalidCount;
        batchCount++;
        
        // Commit batch if reaching limit
        if (batchCount >= MAX_BATCH) {
          batches.push(batch);
          batch = admin.firestore().batch();
          batchCount = 0;
        }
      }
    }
    
    // Add remaining batch
    if (batchCount > 0) {
      batches.push(batch);
    }
    
    // Commit all batches
    await Promise.all(batches.map(b => b.commit()));
    
    console.log('═══════════════════════════════════════');
    console.log(`✅ Cleanup complete!`);
    console.log(`   Total users with tokens: ${totalUsers}`);
    console.log(`   Users cleaned: ${totalCleaned}`);
    console.log(`   Invalid tokens removed: ${totalInvalidTokens}`);
    console.log('═══════════════════════════════════════');
    
    return {
      success: true,
      totalUsers,
      usersCleaned: totalCleaned,
      invalidTokensRemoved: totalInvalidTokens
    };
    
  } catch (error) {
    console.error('❌ Error cleaning up tokens:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================================================
// USER DELETION CLEANUP
// ============================================================================

/**
 * Triggered when a user document is deleted from Firestore
 * Cleans up all associated data: clubs, teams, chats, notifications, etc.
 */
exports.onUserDeleted = functions.firestore
  .document('users/{userId}')
  .onDelete(async (snap, context) => {
    const userId = context.params.userId;
    const userData = snap.data();
    
    console.log('═══════════════════════════════════════');
    console.log('🗑️ USER DELETION CLEANUP STARTED');
    console.log(`👤 User ID: ${userId}`);
    console.log(`📧 Email: ${userData.email || 'N/A'}`);
    console.log('═══════════════════════════════════════');
    
    try {
      const db = admin.firestore();
      const batch = db.batch();
      let operationCount = 0;
      
      // 1. Remove user from all clubs
      console.log('🏠 Cleaning up club memberships...');
      const clubsSnapshot = await db.collection('clubs').get();
      for (const clubDoc of clubsSnapshot.docs) {
        const club = clubDoc.data();
        let clubUpdated = false;
        const updates = {};
        
        // Remove from club members
        if (club.members && club.members.includes(userId)) {
          updates.members = admin.firestore.FieldValue.arrayRemove(userId);
          clubUpdated = true;
        }
        
        // Remove from club admins
        if (club.admins && club.admins.includes(userId)) {
          updates.admins = admin.firestore.FieldValue.arrayRemove(userId);
          clubUpdated = true;
        }
        
        // Remove from teams
        if (club.teams) {
          const updatedTeams = club.teams.map(team => {
            let teamChanged = false;
            const updatedTeam = { ...team };
            
            if (team.members && team.members.includes(userId)) {
              updatedTeam.members = team.members.filter(id => id !== userId);
              teamChanged = true;
            }
            if (team.trainers && team.trainers.includes(userId)) {
              updatedTeam.trainers = team.trainers.filter(id => id !== userId);
              teamChanged = true;
            }
            if (team.assistants && team.assistants.includes(userId)) {
              updatedTeam.assistants = team.assistants.filter(id => id !== userId);
              teamChanged = true;
            }
            
            return teamChanged ? updatedTeam : team;
          });
          
          if (JSON.stringify(updatedTeams) !== JSON.stringify(club.teams)) {
            updates.teams = updatedTeams;
            clubUpdated = true;
          }
        }
        
        if (clubUpdated) {
          batch.update(clubDoc.ref, updates);
          operationCount++;
          console.log(`  ✓ Removed from club: ${club.name || clubDoc.id}`);
        }
      }
      
      // 2. Remove user from all chats
      console.log('💬 Cleaning up chat memberships...');
      const chatsSnapshot = await db.collection('chats')
        .where('participants', 'array-contains', userId)
        .get();
      
      chatsSnapshot.forEach(chatDoc => {
        batch.update(chatDoc.ref, {
          participants: admin.firestore.FieldValue.arrayRemove(userId)
        });
        operationCount++;
      });
      console.log(`  ✓ Removed from ${chatsSnapshot.size} chat(s)`);
      
      // 3. Delete user's notifications
      console.log('🔔 Cleaning up notifications...');
      const notificationsSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .get();
      
      notificationsSnapshot.forEach(notifDoc => {
        batch.delete(notifDoc.ref);
        operationCount++;
      });
      console.log(`  ✓ Deleted ${notificationsSnapshot.size} notification(s)`);
      
      // 4. Delete user's settings
      console.log('⚙️ Cleaning up user settings...');
      const settingsSnapshot = await db.collection(`users/${userId}/settings`).get();
      settingsSnapshot.forEach(settingDoc => {
        batch.delete(settingDoc.ref);
        operationCount++;
      });
      console.log(`  ✓ Deleted ${settingsSnapshot.size} setting(s)`);
      
      // 5. Handle parent-child relationships and DELETE CHILD SUBACCOUNTS
      console.log('👨‍👩‍👧 Cleaning up parent-child relationships...');
      
      // Find all children (subaccounts) where this user is the parent
      const parentRelationships = await db.collection('parentChildRelationships')
        .where('parentId', '==', userId)
        .where('status', '==', 'active')
        .get();
      
      const childrenToDelete = [];
      parentRelationships.forEach(relDoc => {
        const rel = relDoc.data();
        if (rel.childId) {
          childrenToDelete.push(rel.childId);
        }
        batch.delete(relDoc.ref);
        operationCount++;
      });
      
      // Delete all child subaccounts (they don't have their own login)
      if (childrenToDelete.length > 0) {
        console.log(`  🗑️ Found ${childrenToDelete.length} child subaccount(s) to delete...`);
        
        for (const childId of childrenToDelete) {
          try {
            // Delete child's Firestore document
            const childDoc = await db.collection('users').doc(childId).get();
            if (childDoc.exists) {
              const childData = childDoc.data();
              console.log(`    • Deleting child: ${childData.username || childData.email || childId}`);
              
              // Delete child's Auth account if it exists
              try {
                await admin.auth().getUser(childId);
                await admin.auth().deleteUser(childId);
                console.log(`      ✅ Child Auth user deleted`);
              } catch (authError) {
                if (authError.code === 'auth/user-not-found') {
                  console.log(`      ℹ️ Child has no Auth account (subaccount)`);
                } else {
                  console.error(`      ⚠️ Error deleting child Auth:`, authError.message);
                }
              }
              
              // Delete child's Firestore document
              batch.delete(childDoc.ref);
              operationCount++;
              console.log(`      ✅ Child Firestore document deleted`);
            }
          } catch (error) {
            console.error(`    ❌ Error deleting child ${childId}:`, error.message);
          }
        }
      }
      
      // Delete relationships where user is child
      const childRelationships = await db.collection('parentChildRelationships')
        .where('childId', '==', userId)
        .get();
      childRelationships.forEach(relDoc => {
        batch.delete(relDoc.ref);
        operationCount++;
      });
      
      console.log(`  ✓ Deleted ${parentRelationships.size + childRelationships.size} relationship(s)`);
      
      // 6. Update events (remove user from responses)
      console.log('📅 Cleaning up event responses...');
      const eventsSnapshot = await db.collection('events').get();
      let eventUpdates = 0;
      
      for (const eventDoc of eventsSnapshot.docs) {
        const event = eventDoc.data();
        let eventUpdated = false;
        const updates = {};
        
        if (event.responses && event.responses[userId]) {
          updates[`responses.${userId}`] = admin.firestore.FieldValue.delete();
          eventUpdated = true;
        }
        
        if (event.waitlist && event.waitlist.includes(userId)) {
          updates.waitlist = admin.firestore.FieldValue.arrayRemove(userId);
          eventUpdated = true;
        }
        
        if (eventUpdated) {
          batch.update(eventDoc.ref, updates);
          operationCount++;
          eventUpdates++;
        }
      }
      console.log(`  ✓ Cleaned ${eventUpdates} event(s)`);
      
      // 7. Delete substitution requests
      console.log('🔄 Cleaning up substitution requests...');
      const substitutionRequests = await db.collection('substitutionRequests')
        .where('requestedBy', '==', userId)
        .get();
      
      const substitutionResponses = await db.collection('substitutionRequests')
        .where('targetUser', '==', userId)
        .get();
      
      [...substitutionRequests.docs, ...substitutionResponses.docs].forEach(doc => {
        batch.delete(doc.ref);
        operationCount++;
      });
      
      console.log(`  ✓ Deleted ${substitutionRequests.size + substitutionResponses.size} substitution request(s)`);
      
      // Commit all changes in batches (max 500 operations per batch)
      if (operationCount > 0) {
        console.log(`\n💾 Committing ${operationCount} operation(s)...`);
        await batch.commit();
        console.log('✅ All operations committed successfully');
      } else {
        console.log('ℹ️ No cleanup operations needed');
      }
      
      // 8. Delete Firebase Auth user if still exists
      console.log('\n🔐 Checking Firebase Auth user...');
      try {
        await admin.auth().getUser(userId);
        await admin.auth().deleteUser(userId);
        console.log('✅ Firebase Auth user deleted');
      } catch (authError) {
        if (authError.code === 'auth/user-not-found') {
          console.log('ℹ️ Firebase Auth user already deleted');
        } else {
          console.error('⚠️ Error deleting Firebase Auth user:', authError.message);
        }
      }
      
      console.log('═══════════════════════════════════════');
      console.log('✅ USER DELETION CLEANUP COMPLETED');
      console.log(`   Total operations: ${operationCount}`);
      console.log('═══════════════════════════════════════');
      
    } catch (error) {
      console.error('═══════════════════════════════════════');
      console.error('❌ USER DELETION CLEANUP FAILED');
      console.error('Error:', error);
      console.error('═══════════════════════════════════════');
    }
  });

// ============================================================================
// LEAGUE SCHEDULE SCRAPER
// ============================================================================

/**
 * Scrape league schedule from external website
 * Called from client when user wants to sync league games
 */
exports.scrapeLeagueSchedule = functions.https.onCall(async (data, context) => {
  // Must be authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { url, teamIdentifier } = data;

  if (!url) {
    throw new functions.https.HttpsError('invalid-argument', 'URL is required');
  }

  console.log('═══════════════════════════════════════');
  console.log('🔍 LEAGUE SCHEDULE SCRAPER - DEBUG MODE');
  console.log(`📄 URL: ${url}`);
  console.log(`🏒 Team: ${teamIdentifier}`);
  console.log('═══════════════════════════════════════');

  try {
    // Fetch the HTML page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);
    
    // Parse structure: Every game follows this pattern (7 lines):
    // Line 1: Round (e.g., "1. kolo")
    // Line 2: Home team (full name with abbr, e.g., "HC HANISKA FLYERSHAN")
    // Line 3: Score separator (" - : - ")
    // Line 4: Guest team (full name with abbr, e.g., "AHK SOKOĽANYSOK")
    // Line 5: Date (e.g., "10.01.2026 -")
    // Line 6: Time (e.g., "20:30")
    // Line 7: "Detail zápasu"
    
    $('script').remove();
    $('style').remove();
    const bodyText = $('body').text();
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    
    console.log(`\n📊 Total lines: ${lines.length}`);
    console.log('🔍 Parsing games...\n');
    
    const games = [];
    
    // Find all lines with "X. kolo" pattern - these mark the start of games
    for (let i = 0; i < lines.length - 6; i++) {
      const line = lines[i];
      
      // Check if this line is a round indicator
      if (line.match(/^\d+\.\s*kolo$/)) {
        const round = line;
        const homeTeam = lines[i + 1];
        const separator = lines[i + 2];
        const guestTeam = lines[i + 3];
        const dateLine = lines[i + 4];
        const timeLine = lines[i + 5];
        
        // Check separator and extract result if available
        if (separator.includes('-') && separator.includes(':')) {
          // Extract date (remove trailing " -")
          const date = dateLine.replace(/\s*-\s*$/, '').trim();
          const time = timeLine.trim();
          
          // Validate date and time format
          if (date.match(/^\d{2}\.\d{2}\.\d{4}$/) && time.match(/^\d{2}:\d{2}$/)) {
            // Remove last 3 characters (abbreviations) from team names
            const cleanHomeTeam = homeTeam.slice(0, -3).trim();
            const cleanGuestTeam = guestTeam.slice(0, -3).trim();
            
            // Extract result if game has been played (format: "X : Y" instead of "- : -")
            let result = null;
            const scoreMatch = separator.match(/^(\d+)\s*:\s*(\d+)$/);
            if (scoreMatch) {
              result = `${scoreMatch[1]}:${scoreMatch[2]}`;
              console.log(`✅ Game: ${cleanHomeTeam} vs ${cleanGuestTeam} | ${date} ${time} | Result: ${result} | ${round}`);
            } else {
              console.log(`✅ Game: ${cleanHomeTeam} vs ${cleanGuestTeam} | ${date} ${time} | ${round}`);
            }
            
            games.push({
              externalId: `hlcana-${date}-${time}-${i}`.replace(/[\s:.]/g, '-'),
              round,
              homeTeam: cleanHomeTeam,
              guestTeam: cleanGuestTeam,
              date,
              time,
              result,
              type: 'game',
              location: teamIdentifier && cleanHomeTeam.includes(teamIdentifier) ? 'home' : 
                        teamIdentifier && cleanGuestTeam.includes(teamIdentifier) ? 'away' : 'neutral',
              notes: `Scraped from ${url}`
            });
          }
        }
      }
    }

    console.log(`✅ Successfully scraped ${games.length} games`);
    console.log('═══════════════════════════════════════');

    return {
      success: true,
      games,
      scrapedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Scraping error:', error);
    console.error('═══════════════════════════════════════');
    
    throw new functions.https.HttpsError(
      'internal',
      `Failed to scrape league schedule: ${error.message}`
    );
  }
});


