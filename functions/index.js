// functions/index.js - FIXED VERSION with FCM v1 API
// Firebase Cloud Functions for Push Notifications

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

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
