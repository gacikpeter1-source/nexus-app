// functions/index.js - FIXED VERSION with FCM v1 API
// Firebase Cloud Functions for Push Notifications

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.setCustomClaims = functions.https.onCall(async (data, context) => {
  const { userId, role, isSuperAdmin } = data;
  await admin.auth().setCustomUserClaims(userId, { role, isSuperAdmin });
  return { success: true };
});

// Add at top of file
async function areNotificationsEnabled(clubId, teamId, notificationType) {
  try {
    const path = teamId 
      ? `clubs/${clubId}/teams/${teamId}/notificationSettings/config`
      : `clubs/${clubId}/notificationSettings/config`;
    
    const settingsDoc = await admin.firestore().doc(path).get();
    
    if (!settingsDoc.exists()) {
      return false;
    }
    
    const settings = settingsDoc.data();
    const parts = notificationType.split('.');
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
    console.error('Error checking notification settings:', error);
    return false;
  }
}

async function sendEmailNotification(userIds, subject, body) {
  try {
    const emails = [];
    for (const userId of userIds) {
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      if (userDoc.exists()) {
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
        const teamDoc = await admin.firestore()
          .collection('clubs')
          .doc(event.clubId)
          .collection('teams')
          .doc(event.teamId)
          .get();
        
        if (teamDoc.exists) {
          const teamData = teamDoc.data();
          (teamData.members || []).forEach(id => targetUserIds.add(id));
          (teamData.assistants || []).forEach(id => targetUserIds.add(id));
        }
      } else {
        // Event for all club members
        (clubData.members || []).forEach(id => targetUserIds.add(id));
        (clubData.admins || []).forEach(id => targetUserIds.add(id));
        
        // Include all team members if no specific team
        const teamsSnapshot = await admin.firestore()
          .collection('clubs')
          .doc(event.clubId)
          .collection('teams')
          .get();
        
        teamsSnapshot.forEach(teamDoc => {
          const team = teamDoc.data();
          (team.members || []).forEach(id => targetUserIds.add(id));
          (team.assistants || []).forEach(id => targetUserIds.add(id));
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
      targetUserIds = Array.from(targetUserIds).filter(id => id !== event.createdBy);

      if (targetUserIds.length === 0) {
        console.log('ℹ️ No users to notify');
        return;
      }

      console.log(`👥 Notifying ${targetUserIds.length} users`);

      // Send push notifications if enabled
      if (pushEnabled) {
        // Get FCM tokens for all users
        const tokens = await getUserTokens(targetUserIds);

        if (tokens.length > 0) {
          console.log(`🔔 Sending push to ${tokens.length} devices`);

          // Send notification
          const result = await sendMulticastNotification(
            tokens,
            {
              title: '📅 New Event Created',
              body: `${event.title} - ${new Date(event.start).toLocaleDateString()}`
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

      // Send email notifications if enabled
      if (emailEnabled) {
        await sendEmailNotification(
          targetUserIds,
          `📅 New Event: ${event.title}`,
          `A new event has been created:\n\n${event.title}\n${new Date(event.start).toLocaleDateString()}\n\nLocation: ${event.location || 'TBD'}\n\nCheck the app for more details.`
        );
      }

      console.log('✅ Event notification complete');
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
      before.start !== after.start ||
      before.end !== after.end ||
      before.location !== after.location;
    
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

      // Get users who responded to this event
      const responses = after.responses || {};
      let targetUserIds = new Set(Object.keys(responses));

      // Convert to array and filter
      targetUserIds = Array.from(targetUserIds).filter(id => id !== after.createdBy);

      if (targetUserIds.length === 0) {
        console.log('ℹ️ No attendees to notify');
        return;
      }

      console.log(`👥 Notifying ${targetUserIds.length} attendees`);

      // Determine what changed
      let changeDescription = '';
      if (before.title !== after.title) changeDescription = 'Title changed';
      else if (before.start !== after.start || before.end !== after.end) changeDescription = 'Time changed';
      else if (before.location !== after.location) changeDescription = 'Location changed';

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

      // Send email notifications if enabled
      if (emailEnabled) {
        await sendEmailNotification(
          targetUserIds,
          `📝 Event Updated: ${after.title}`,
          `The event "${after.title}" has been updated.\n\n${changeDescription}\n\nCheck the app for updated details.`
        );
      }

      console.log('✅ Event update notification complete');
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

      // Get users who responded
      const responses = event.responses || {};
      let targetUserIds = Array.from(new Set(Object.keys(responses)));

      if (targetUserIds.length === 0) {
        console.log('ℹ️ No attendees to notify');
        return;
      }

      console.log(`👥 Notifying ${targetUserIds.length} attendees`);

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

      // Send email notifications if enabled
      if (emailEnabled) {
        await sendEmailNotification(
          targetUserIds,
          `❌ Event Cancelled: ${event.title}`,
          `The event "${event.title}" has been cancelled.\n\nPlease check the app for more information.`
        );
      }

      console.log('✅ Event deletion notification complete');
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

  const { eventId, response } = data; // response: 'accept' or 'decline'
  const userId = context.auth.uid;

  try {
    const eventRef = admin.firestore().collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Event not found');
    }

    const event = eventDoc.data();
    const responses = event.responses || {};

    // Check if user is in waitlist
    const attendingList = Object.entries(responses)
      .filter(([_, r]) => r.status === 'attending')
      .sort((a, b) => (a[1].timestamp?._seconds || 0) - (b[1].timestamp?._seconds || 0));

    const userIndex = attendingList.findIndex(([id]) => id === userId);
    const isInWaitlist = event.participantLimit && userIndex >= event.participantLimit;

    if (!isInWaitlist) {
      return { success: false, message: 'User not in waitlist' };
    }

    if (response === 'accept') {
      // User accepted - they stay in attending list (already there)
      // Mark as "confirmed from waitlist"
      responses[userId] = {
        ...responses[userId],
        waitlistConfirmed: true,
        waitlistConfirmedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await eventRef.update({ responses });

      // Remove pending notification for this user
      await removePendingNotification(eventId, userId);

      // Process queue - might notify next person if still spots available
      await processWaitlistQueue(eventId);

      return { success: true, message: 'Confirmed attendance' };

    } else {
      // User declined - remove from attending
      responses[userId] = {
        status: 'declined',
        message: 'Declined from waitlist',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      await eventRef.update({ responses });

      // Remove pending notification
      await removePendingNotification(eventId, userId);

      // Immediately notify next person in queue
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
    
    // Only process if event has participant limit
    if (!event.participantLimit) return;

    const responses = event.responses || {};

    // Get sorted attending list
    const attendingList = Object.entries(responses)
      .filter(([_, r]) => r.status === 'attending')
      .sort((a, b) => (a[1].timestamp?._seconds || 0) - (b[1].timestamp?._seconds || 0));

    const activeCount = Math.min(attendingList.length, event.participantLimit);
    const waitlistUsers = attendingList.slice(event.participantLimit);

    // Get pending notifications
    const pendingNotifications = await getPendingNotifications(eventId);
    const alreadyNotified = new Set(pendingNotifications.map(n => n.userId));

    // Calculate how many spots are available
    const spotsAvailable = event.participantLimit - activeCount;

    if (spotsAvailable <= 0 || waitlistUsers.length === 0) {
      return; // No spots or no waitlist
    }

    // Notify users for available spots (excluding already notified)
    const usersToNotify = waitlistUsers
      .filter(([userId]) => !alreadyNotified.has(userId))
      .slice(0, spotsAvailable);

    for (const [userId, userData] of usersToNotify) {
      await sendWaitlistNotification(eventId, userId, event);
      await createPendingNotification(eventId, userId);
      
      // Schedule 5-minute timeout
      await scheduleTimeout(eventId, userId);
    }

  } catch (error) {
    console.error('Error processing waitlist queue:', error);
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

    if (tokens.length === 0) return;

    const message = {
      notification: {
        title: '🎉 Spot Available!',
        body: `A spot opened up for ${event.title}. Accept within 5 minutes!`
      },
      data: {
        type: 'waitlist_promotion',
        eventId: eventId,
        userId: userId,
        requiresResponse: 'true'
      },
      tokens: tokens
    };

    await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Waitlist notification sent to user ${userId}`);

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
