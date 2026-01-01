// src/firebase/notifications.js
// In-app notification center functionality

import { db } from './config';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

/**
 * Create a new in-app notification
 * @param {Object} notificationData - Notification data
 * @returns {Promise<string>} - Notification ID
 */
export const createNotification = async (notificationData) => {
  try {
    const notification = {
      userId: notificationData.userId,
      type: notificationData.type, // 'event', 'chat', 'waitlist', 'order', 'announcement', etc.
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data || {}, // Additional context data
      
      // Metadata
      read: false,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
      
      // Optional fields
      clubId: notificationData.clubId || null,
      teamId: notificationData.teamId || null,
      eventId: notificationData.eventId || null,
      chatId: notificationData.chatId || null,
      
      // Action link
      actionUrl: notificationData.actionUrl || null,
    };

    const notifRef = await addDoc(collection(db, 'notifications'), notification);
    console.log('✅ In-app notification created:', notifRef.id);
    return notifRef.id;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }
};

/**
 * Get all notifications for a user
 * @param {string} userId - User ID
 * @param {number} limitCount - Maximum number of notifications to fetch
 * @returns {Promise<Array>} - Array of notifications
 */
export const getUserNotifications = async (userId, limitCount = 50) => {
  try {
    console.log('🔍 Querying notifications for userId:', userId);
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    console.log('📡 Executing Firestore query...');
    const querySnapshot = await getDocs(q);
    console.log('📦 Query returned', querySnapshot.size, 'documents');
    
    const notifications = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('📄 Document:', doc.id, data);
      
      // Check if expired
      if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        console.log('⏰ Skipping expired notification:', doc.id);
        return; // Skip expired notifications
      }
      notifications.push({ id: doc.id, ...data });
    });

    console.log('✅ Returning', notifications.length, 'notifications');
    return notifications;
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    throw error;
  }
};

/**
 * Get unread notification count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Count of unread notifications
 */
export const getUnreadCount = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    let count = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Only count non-expired notifications
      if (!data.expiresAt || data.expiresAt.toDate() >= new Date()) {
        count++;
      }
    });

    return count;
  } catch (error) {
    console.error('❌ Error counting unread notifications:', error);
    return 0;
  }
};

/**
 * Mark a notification as read
 * @param {string} notificationId - Notification ID
 */
export const markAsRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: serverTimestamp()
    });
    console.log('✅ Notification marked as read');
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 */
export const markAllAsRead = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    const updatePromises = [];

    querySnapshot.forEach((docSnap) => {
      updatePromises.push(
        updateDoc(doc(db, 'notifications', docSnap.id), {
          read: true,
          readAt: serverTimestamp()
        })
      );
    });

    await Promise.all(updatePromises);
    console.log(`✅ Marked ${updatePromises.length} notifications as read`);
  } catch (error) {
    console.error('❌ Error marking all as read:', error);
    throw error;
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 */
export const deleteNotification = async (notificationId) => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
    console.log('✅ Notification deleted');
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    throw error;
  }
};

/**
 * Delete all notifications for a user
 * @param {string} userId - User ID
 */
export const deleteAllNotifications = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const deletePromises = [];

    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(db, 'notifications', docSnap.id)));
    });

    await Promise.all(deletePromises);
    console.log(`✅ Deleted ${deletePromises.length} notifications`);
  } catch (error) {
    console.error('❌ Error deleting all notifications:', error);
    throw error;
  }
};

/**
 * Delete expired notifications (called by cleanup function)
 * @returns {Promise<number>} - Number of deleted notifications
 */
export const cleanupExpiredNotifications = async () => {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'notifications'),
      where('expiresAt', '<', now)
    );

    const querySnapshot = await getDocs(q);
    const deletePromises = [];

    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(db, 'notifications', docSnap.id)));
    });

    await Promise.all(deletePromises);
    console.log(`🧹 Cleaned up ${deletePromises.length} expired notifications`);
    return deletePromises.length;
  } catch (error) {
    console.error('❌ Error cleaning up notifications:', error);
    throw error;
  }
};

