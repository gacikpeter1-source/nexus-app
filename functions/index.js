// functions/index.js
// Firebase Cloud Functions for Push Notifications

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

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
    // Prepare message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      tokens: tokens
    };

    // Send to multiple devices
    const response = await admin.messaging().sendMulticast(message);

    console.log(`Successfully sent ${response.successCount} notifications`);
    console.log(`Failed to send ${response.failureCount} notifications`);

    // Clean up invalid tokens
    const tokensToRemove = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
          tokensToRemove.push(tokens[idx]);
        }
      }
    });

    // Remove invalid tokens from database
    if (tokensToRemove.length > 0) {
      await cleanupInvalidTokens(tokensToRemove);
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Remove invalid FCM tokens from user documents
 */
async function cleanupInvalidTokens(tokens) {
  const db = admin.firestore();
  const usersRef = db.collection('users');

  for (const token of tokens) {
    const querySnapshot = await usersRef
      .where('fcmTokens', 'array-contains', token)
      .get();

    querySnapshot.forEach(async (doc) => {
      await doc.ref.update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
      });
    });
  }

  console.log(`Cleaned up ${tokens.length} invalid tokens`);
}

/**
 * Firestore Trigger: Send notification when event is created
 */
exports.onEventCreated = functions.firestore
  .document('events/{eventId}')
  .onCreate(async (snap, context) => {
    const event = snap.data();
    
    try {
      // Get club data to find members
      const clubDoc = await admin.firestore()
        .collection('clubs')
        .doc(event.clubId)
        .get();
      
      if (!clubDoc.exists) {
        console.log('Club not found');
        return;
      }

      const clubData = clubDoc.data();
      let targetUserIds = new Set();

      // Personal events - no notifications (only creator)
      if (event.visibilityLevel === 'personal') {
        console.log('Personal event - no notifications sent');
        return;
      }

      // Team events - notify all team members, trainers, and assistants
      if (event.visibilityLevel === 'team' && event.teamId) {
        const team = clubData.teams?.find(t => t.id === event.teamId);
        if (team) {
          (team.members || []).forEach(id => targetUserIds.add(id));
          (team.trainers || []).forEach(id => targetUserIds.add(id));
          (team.assistants || []).forEach(id => targetUserIds.add(id));
        }
      }

      // Club events - notify ALL members from ALL teams + club-level roles
      if (event.visibilityLevel === 'club') {
        // Add club-level trainers and assistants
        (clubData.trainers || []).forEach(id => targetUserIds.add(id));
        (clubData.assistants || []).forEach(id => targetUserIds.add(id));
        (clubData.members || []).forEach(id => targetUserIds.add(id));
        
        // Add members from all teams
        (clubData.teams || []).forEach(team => {
          (team.members || []).forEach(id => targetUserIds.add(id));
          (team.trainers || []).forEach(id => targetUserIds.add(id));
          (team.assistants || []).forEach(id => targetUserIds.add(id));
        });
      }

      // Convert Set to Array and remove event creator (don't notify them)
      targetUserIds = Array.from(targetUserIds).filter(id => id !== event.createdBy);

      if (targetUserIds.length === 0) {
        console.log('No users to notify');
        return;
      }

      // Get FCM tokens for all users
      const tokens = await getUserTokens(targetUserIds);

      if (tokens.length === 0) {
        console.log('No FCM tokens found');
        return;
      }

      // Send notification
      const message = {
        notification: {
          title: '📅 New Event Created',
          body: `${event.title} - ${new Date(event.start).toLocaleDateString()}`
        },
        data: {
          type: 'event_new',
          eventId: context.params.eventId,
          clubId: event.clubId,
          teamId: event.teamId || ''
        },
        tokens: tokens
      };

      const response = await admin.messaging().sendMulticast(message);
      console.log(`Event notification sent: ${response.successCount} success, ${response.failureCount} failed`);
    } catch (error) {
      console.error('Error sending event notification:', error);
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
      return; // No notification needed
    }

    try {
      // Get club data to find all users who can see this event
      const clubDoc = await admin.firestore()
        .collection('clubs')
        .doc(after.clubId)
        .get();
      
      if (!clubDoc.exists) {
        console.log('Club not found');
        return;
      }

      const clubData = clubDoc.data();
      let targetUserIds = new Set();

      // Get users who responded (they're definitely interested)
      const responses = after.responses || {};
      Object.keys(responses).forEach(id => targetUserIds.add(id));

      // Also notify all users who CAN see the event but haven't responded yet
      if (after.visibilityLevel === 'team' && after.teamId) {
        const team = clubData.teams?.find(t => t.id === after.teamId);
        if (team) {
          (team.members || []).forEach(id => targetUserIds.add(id));
          (team.trainers || []).forEach(id => targetUserIds.add(id));
          (team.assistants || []).forEach(id => targetUserIds.add(id));
        }
      } else if (after.visibilityLevel === 'club') {
        // Notify everyone in club
        (clubData.trainers || []).forEach(id => targetUserIds.add(id));
        (clubData.assistants || []).forEach(id => targetUserIds.add(id));
        (clubData.members || []).forEach(id => targetUserIds.add(id));
        
        (clubData.teams || []).forEach(team => {
          (team.members || []).forEach(id => targetUserIds.add(id));
          (team.trainers || []).forEach(id => targetUserIds.add(id));
          (team.assistants || []).forEach(id => targetUserIds.add(id));
        });
      }

      // Remove event creator (don't notify them of their own changes)
      targetUserIds = Array.from(targetUserIds).filter(id => id !== after.createdBy);

      if (targetUserIds.length === 0) {
        console.log('No users to notify');
        return;
      }

      const tokens = await getUserTokens(targetUserIds);

      if (tokens.length === 0) {
        console.log('No FCM tokens found');
        return;
      }

      const message = {
        notification: {
          title: '📝 Event Updated',
          body: `${after.title} has been modified`
        },
        data: {
          type: 'event_modified',
          eventId: context.params.eventId,
          clubId: after.clubId
        },
        tokens: tokens
      };

      const response = await admin.messaging().sendMulticast(message);
      console.log(`Event update notification sent: ${response.successCount} success`);
    } catch (error) {
      console.error('Error sending event update notification:', error);
    }
  });

/**
 * Firestore Trigger: Send notification when event is deleted
 */
exports.onEventDeleted = functions.firestore
  .document('events/{eventId}')
  .onDelete(async (snap, context) => {
    const event = snap.data();
    
    try {
      // Get club data to find all users who could see this event
      const clubDoc = await admin.firestore()
        .collection('clubs')
        .doc(event.clubId)
        .get();
      
      if (!clubDoc.exists) {
        console.log('Club not found');
        return;
      }

      const clubData = clubDoc.data();
      let targetUserIds = new Set();

      // Get users who responded (they definitely knew about it)
      const responses = event.responses || {};
      Object.keys(responses).forEach(id => targetUserIds.add(id));

      // Also notify all users who COULD have seen the event
      if (event.visibilityLevel === 'team' && event.teamId) {
        const team = clubData.teams?.find(t => t.id === event.teamId);
        if (team) {
          (team.members || []).forEach(id => targetUserIds.add(id));
          (team.trainers || []).forEach(id => targetUserIds.add(id));
          (team.assistants || []).forEach(id => targetUserIds.add(id));
        }
      } else if (event.visibilityLevel === 'club') {
        (clubData.trainers || []).forEach(id => targetUserIds.add(id));
        (clubData.assistants || []).forEach(id => targetUserIds.add(id));
        (clubData.members || []).forEach(id => targetUserIds.add(id));
        
        (clubData.teams || []).forEach(team => {
          (team.members || []).forEach(id => targetUserIds.add(id));
          (team.trainers || []).forEach(id => targetUserIds.add(id));
          (team.assistants || []).forEach(id => targetUserIds.add(id));
        });
      }

      targetUserIds = Array.from(targetUserIds).filter(id => id !== event.createdBy);

      if (targetUserIds.length === 0) {
        console.log('No users to notify');
        return;
      }

      const tokens = await getUserTokens(targetUserIds);

      if (tokens.length === 0) {
        console.log('No FCM tokens found');
        return;
      }

      const message = {
        notification: {
          title: '❌ Event Cancelled',
          body: `${event.title} has been cancelled`
        },
        data: {
          type: 'event_deleted',
          clubId: event.clubId
        },
        tokens: tokens
      };

      const response = await admin.messaging().sendMulticast(message);
      console.log(`Event deletion notification sent: ${response.successCount} success`);
    } catch (error) {
      console.error('Error sending event deletion notification:', error);
    }
  });

/**
 * Helper: Get FCM tokens for multiple users
 */
async function getUserTokens(userIds) {
  const tokens = [];
  const db = admin.firestore();

  for (const userId of userIds) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
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
 * Firestore Trigger: Send notification when order is created
 */
exports.onOrderCreated = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const order = snap.data();
    
    try {
      // Get club data to find eligible users
      const clubDoc = await admin.firestore()
        .collection('clubs')
        .doc(order.clubId)
        .get();
      
      if (!clubDoc.exists) {
        console.log('Club not found');
        return;
      }

      const clubData = clubDoc.data();
      const eligibleUserIds = new Set();

      // If order is for all teams (no specific teams selected)
      if (!order.teams || order.teams.length === 0) {
        // Notify all club members
        (clubData.trainers || []).forEach(id => eligibleUserIds.add(id));
        (clubData.assistants || []).forEach(id => eligibleUserIds.add(id));
        (clubData.members || []).forEach(id => eligibleUserIds.add(id));
        
        // Add all team members
        (clubData.teams || []).forEach(team => {
          (team.members || []).forEach(id => eligibleUserIds.add(id));
          (team.trainers || []).forEach(id => eligibleUserIds.add(id));
          (team.assistants || []).forEach(id => eligibleUserIds.add(id));
        });
      } else {
        // Specific teams - only members of those teams
        order.teams.forEach(teamId => {
          const team = clubData.teams?.find(t => t.id === teamId);
          if (team) {
            (team.members || []).forEach(id => eligibleUserIds.add(id));
            (team.trainers || []).forEach(id => eligibleUserIds.add(id));
            (team.assistants || []).forEach(id => eligibleUserIds.add(id));
          }
        });
      }

      // Remove order creator (don't notify them)
      const targetUserIds = Array.from(eligibleUserIds).filter(id => id !== order.createdBy);

      if (targetUserIds.length === 0) {
        console.log('No users to notify');
        return;
      }

      const tokens = await getUserTokens(targetUserIds);

      if (tokens.length === 0) {
        console.log('No FCM tokens found');
        return;
      }

      // Send notification
      const message = {
        notification: {
          title: '🛒 New Order Available',
          body: `"${order.title}" - Respond by ${new Date(order.deadline).toLocaleDateString()}`
        },
        data: {
          type: 'order_new',
          orderId: context.params.orderId,
          clubId: order.clubId
        },
        tokens: tokens
      };

      const response = await admin.messaging().sendMulticast(message);
      console.log(`New order notification sent: ${response.successCount} success, ${response.failureCount} failed`);
    } catch (error) {
      console.error('Error sending new order notification:', error);
    }
  });

/**
 * Scheduled Function: Check order deadlines daily
 * Runs every day at 9 AM
 */
exports.checkOrderDeadlines = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Europe/Bratislava')
  .onRun(async (context) => {
    console.log('Checking order deadlines...');
    
    try {
      const db = admin.firestore();
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get orders with deadline today or tomorrow
      const ordersSnapshot = await db
        .collection('orders')
        .where('status', '==', 'pending')
        .get();

      for (const doc of ordersSnapshot.docs) {
        const order = doc.data();
        const deadline = new Date(order.deadline);
        const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

        if (daysUntil === 0 || daysUntil === 1) {
          // Get all responses for this order
          const responsesSnapshot = await db
            .collection('orderResponses')
            .where('orderId', '==', doc.id)
            .get();
          
          // Get users who already responded
          const respondedUserIds = new Set();
          responsesSnapshot.forEach(responseDoc => {
            respondedUserIds.add(responseDoc.data().userId);
          });

          // Get eligible users who haven't responded yet (status = pending)
          const clubDoc = await db.collection('clubs').doc(order.clubId).get();
          if (!clubDoc.exists) {
            console.log(`Club ${order.clubId} not found`);
            continue;
          }

          const clubData = clubDoc.data();
          const eligibleUserIds = new Set();

          // If order is for all teams (no specific teams selected)
          if (!order.teams || order.teams.length === 0) {
            // All club members are eligible
            (clubData.trainers || []).forEach(id => eligibleUserIds.add(id));
            (clubData.assistants || []).forEach(id => eligibleUserIds.add(id));
            (clubData.members || []).forEach(id => eligibleUserIds.add(id));
            
            // Add all team members
            (clubData.teams || []).forEach(team => {
              (team.members || []).forEach(id => eligibleUserIds.add(id));
              (team.trainers || []).forEach(id => eligibleUserIds.add(id));
              (team.assistants || []).forEach(id => eligibleUserIds.add(id));
            });
          } else {
            // Specific teams - only members of those teams
            order.teams.forEach(teamId => {
              const team = clubData.teams?.find(t => t.id === teamId);
              if (team) {
                (team.members || []).forEach(id => eligibleUserIds.add(id));
                (team.trainers || []).forEach(id => eligibleUserIds.add(id));
                (team.assistants || []).forEach(id => eligibleUserIds.add(id));
              }
            });
          }

          // Get users with PENDING status (eligible but not responded yet)
          const pendingUserIds = Array.from(eligibleUserIds).filter(
            id => !respondedUserIds.has(id)
          );

          if (pendingUserIds.length === 0) {
            console.log(`No pending users for order ${doc.id}`);
            continue;
          }

          // Send reminder to pending users only
          const tokens = await getUserTokens(pendingUserIds);
          
          if (tokens.length > 0) {
            const body = daysUntil === 0 
              ? `Order "${order.title}" deadline is TODAY!`
              : `Order "${order.title}" deadline is TOMORROW!`;

            const message = {
              notification: {
                title: '⏰ Order Deadline Reminder',
                body: body
              },
              data: {
                type: 'order_deadline',
                orderId: doc.id,
                clubId: order.clubId
              },
              tokens: tokens
            };

            await admin.messaging().sendMulticast(message);
            console.log(`Deadline reminder sent for order ${doc.id} to ${pendingUserIds.length} users`);
          }
        }
      }
    } catch (error) {
      console.error('Error checking order deadlines:', error);
    }
  });
