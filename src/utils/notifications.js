// src/utils/notifications.js
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Send push notification to specific users
 * This requires Firebase Cloud Functions on the backend
 */
export const sendNotificationToUsers = async (userIds, notification) => {
  try {
    // Get FCM tokens for all target users
    const tokens = [];
    
    for (const userId of userIds) {
      const userQuery = query(
        collection(db, 'users'),
        where('__name__', '==', userId)
      );
      const userSnap = await getDocs(userQuery);
      
      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data();
        const userTokens = userData.fcmTokens || [];
        tokens.push(...userTokens);
      }
    }

    if (tokens.length === 0) {
      console.log('No FCM tokens found for users');
      return { success: true, message: 'No tokens found' };
    }

    // Import and call Firebase Cloud Function
    const functions = getFunctions();
    const sendNotificationFn = httpsCallable(functions, 'sendNotification');

    const result = await sendNotificationFn({
      tokens: tokens,
      notification: notification
    });

    console.log('✅ Notification sent successfully');
    return result.data;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    throw error;
  }
};

/**
 * Notify users about new event
 */
export const notifyEventCreated = async (event, clubMembers, teamMembers) => {
  const notification = {
    title: '📅 New Event Created',
    body: `${event.title} - ${new Date(event.start).toLocaleDateString()}`,
    data: {
      type: 'event_new',
      eventId: event.id,
      clubId: event.clubId,
      teamId: event.teamId
    }
  };

  // Notify all team members or club members
  const targetUsers = event.teamId ? teamMembers : clubMembers;
  await sendNotificationToUsers(targetUsers, notification);
};

/**
 * Notify users about modified event
 */
export const notifyEventModified = async (event, affectedUserIds) => {
  const notification = {
    title: '📝 Event Updated',
    body: `${event.title} has been modified`,
    data: {
      type: 'event_modified',
      eventId: event.id,
      clubId: event.clubId
    }
  };

  await sendNotificationToUsers(affectedUserIds, notification);
};

/**
 * Notify users about deleted event
 */
export const notifyEventDeleted = async (eventTitle, affectedUserIds) => {
  const notification = {
    title: '❌ Event Cancelled',
    body: `${eventTitle} has been cancelled`,
    data: {
      type: 'event_deleted'
    }
  };

  await sendNotificationToUsers(affectedUserIds, notification);
};

/**
 * Notify about new order
 */
export const notifyNewOrder = async (order, adminUserIds) => {
  const notification = {
    title: '🛒 New Order Received',
    body: `Order #${order.orderNumber} is waiting for review`,
    data: {
      type: 'order_new',
      orderId: order.id
    }
  };

  await sendNotificationToUsers(adminUserIds, notification);
};

/**
 * Notify about order deadline
 */
export const notifyOrderDeadline = async (order, userIds) => {
  const daysUntil = Math.ceil((new Date(order.deadline) - new Date()) / (1000 * 60 * 60 * 24));
  
  let body = '';
  if (daysUntil === 0) {
    body = `Order #${order.orderNumber} deadline is TODAY!`;
  } else if (daysUntil === 1) {
    body = `Order #${order.orderNumber} deadline is TOMORROW!`;
  }

  const notification = {
    title: '⏰ Order Deadline Reminder',
    body: body,
    data: {
      type: 'order_deadline',
      orderId: order.id
    }
  };

  await sendNotificationToUsers(userIds, notification);
};

/**
 * Notify user moved from backlog to normal attendance
 */
export const notifyAttendancePromoted = async (userId, event) => {
  const notification = {
    title: '🎉 You\'re In!',
    body: `A spot opened up for ${event.title}. You're now confirmed!`,
    data: {
      type: 'attendance_promoted',
      eventId: event.id
    }
  };

  await sendNotificationToUsers([userId], notification);
};

/**
 * Get all club/team members who should receive notification
 */
export const getNotificationRecipients = async (clubId, teamId = null) => {
  try {
    const clubQuery = query(
      collection(db, 'clubs'),
      where('__name__', '==', clubId)
    );
    const clubSnap = await getDocs(clubQuery);
    
    if (clubSnap.empty) {
      return [];
    }

    const clubData = clubSnap.docs[0].data();
    
    if (teamId) {
      // Get team members
      const team = clubData.teams?.find(t => t.id === teamId);
      return team?.members || [];
    } else {
      // Get all club members
      return clubData.members || [];
    }
  } catch (error) {
    console.error('Error getting notification recipients:', error);
    return [];
  }
};
