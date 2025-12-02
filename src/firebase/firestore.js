// src/firebase/firestore.js
// Helper functions for Firestore operations

import { db } from './config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

/* ===========================
   USERS COLLECTION
   =========================== */

export const createUser = async (userId, userData) => {
  try {
    await setDoc(doc(db, 'users', userId), {
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const getUser = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

export const getUserByEmail = async (email) => {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
};

export const updateUser = async (userId, updates) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const getAllUsers = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

export const deleteUser = async (userId) => {
  try {
    await deleteDoc(doc(db, 'users', userId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/* ===========================
   CLUBS COLLECTION
   =========================== */

export const createClub = async (clubData) => {
  try {
    const docRef = await addDoc(collection(db, 'clubs'), {
      ...clubData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...clubData };
  } catch (error) {
    console.error('Error creating club:', error);
    throw error;
  }
};

export const getClub = async (clubId) => {
  try {
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    if (clubDoc.exists()) {
      return { id: clubDoc.id, ...clubDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting club:', error);
    throw error;
  }
};

export const getClubByCode = async (clubCode) => {
  try {
    const q = query(collection(db, 'clubs'), where('clubCode', '==', clubCode));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const clubDoc = snapshot.docs[0];
      return { id: clubDoc.id, ...clubDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting club by code:', error);
    throw error;
  }
};

export const updateClub = async (clubId, updates) => {
  try {
    await updateDoc(doc(db, 'clubs', clubId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating club:', error);
    throw error;
  }
};

export const getAllClubs = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'clubs'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting all clubs:', error);
    throw error;
  }
};

export const getUserClubs = async (userId) => {
  try {
    const allClubs = await getAllClubs();
    return allClubs.filter(club => 
      club.members?.includes(userId) ||
      club.trainers?.includes(userId) ||
      club.assistants?.includes(userId)
    );
  } catch (error) {
    console.error('Error getting user clubs:', error);
    throw error;
  }
};

export const deleteClub = async (clubId) => {
  try {
    await deleteDoc(doc(db, 'clubs', clubId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting club:', error);
    throw error;
  }
};

/* ===========================
   EVENTS COLLECTION
   =========================== */

export const createEvent = async (eventData) => {
  try {
    const docRef = await addDoc(collection(db, 'events'), {
      ...eventData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...eventData };
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};

export const getEvent = async (eventId) => {
  try {
    const eventDoc = await getDoc(doc(db, 'events', eventId));
    if (eventDoc.exists()) {
      return { id: eventDoc.id, ...eventDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting event:', error);
    throw error;
  }
};

export const updateEvent = async (eventId, updates) => {
  try {
    await updateDoc(doc(db, 'events', eventId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
};

export const deleteEvent = async (eventId) => {
  try {
    await deleteDoc(doc(db, 'events', eventId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
};

export const getClubEvents = async (clubId) => {
  try {
    const q = query(collection(db, 'events'), where('clubId', '==', clubId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting club events:', error);
    throw error;
  }
};

export const getTeamEvents = async (teamId) => {
  try {
    const q = query(collection(db, 'events'), where('teamId', '==', teamId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting team events:', error);
    throw error;
  }
};

// Add or update RSVP response for an event
export const updateEventResponse = async (eventId, userId, status, message = '') => {
  try {
    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await getDoc(eventRef);
    
    if (!eventDoc.exists()) {
      throw new Error('Event not found');
    }

    const currentResponses = eventDoc.data().responses || {};
    const updatedResponses = {
      ...currentResponses,
      [userId]: {
        status, // 'attending', 'declined', 'maybe'
        message: message || undefined, // Only save if provided
        timestamp: serverTimestamp()
      }
    };

    await updateDoc(eventRef, {
      responses: updatedResponses,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating event response:', error);
    throw error;
  }
};

// Get all events for a user (where they're a member of the team/club OR invited)
export const getUserEvents = async (userId) => {
  try {
    // Get all clubs user is part of
    const allClubs = await getAllClubs();
    const userClubs = allClubs.filter(club =>
      (club.members || []).includes(userId) ||
      (club.trainers || []).includes(userId) ||
      (club.assistants || []).includes(userId)
    );

    // Get all events from user's clubs
    const allEvents = [];
    for (const club of userClubs) {
      const clubEvents = await getClubEvents(club.id);
      allEvents.push(...clubEvents);
    }

    // Also get personal events created by user
    const q = query(
      collection(db, 'events'),
      where('createdBy', '==', userId),
      where('visibilityLevel', '==', 'personal')
    );
    const personalSnapshot = await getDocs(q);
    const personalEvents = personalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    allEvents.push(...personalEvents);

    // Get all events where user has RSVP'd (invited events)
    const allEventsSnapshot = await getDocs(collection(db, 'events'));
    const invitedEvents = allEventsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(event => event.responses && event.responses[userId]);

    allEvents.push(...invitedEvents);

    // Remove duplicates
    const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values());
    
    return uniqueEvents;
  } catch (error) {
    console.error('Error getting user events:', error);
    throw error;
  }
};

/* ===========================
   REQUESTS COLLECTION
   =========================== */

export const createRequest = async (requestData) => {
  try {
    const docRef = await addDoc(collection(db, 'requests'), {
      ...requestData,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...requestData };
  } catch (error) {
    console.error('Error creating request:', error);
    throw error;
  }
};

export const getRequest = async (requestId) => {
  try {
    const requestDoc = await getDoc(doc(db, 'requests', requestId));
    if (requestDoc.exists()) {
      return { id: requestDoc.id, ...requestDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting request:', error);
    throw error;
  }
};

export const updateRequest = async (requestId, updates) => {
  try {
    await updateDoc(doc(db, 'requests', requestId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating request:', error);
    throw error;
  }
};

export const getPendingRequests = async (clubId = null) => {
  try {
    let q;
    if (clubId) {
      q = query(
        collection(db, 'requests'),
        where('clubId', '==', clubId),
        where('status', '==', 'pending')
      );
    } else {
      q = query(collection(db, 'requests'), where('status', '==', 'pending'));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting pending requests:', error);
    throw error;
  }
};

export const deleteRequest = async (requestId) => {
  try {
    await deleteDoc(doc(db, 'requests', requestId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting request:', error);
    throw error;
  }
};

/* ===========================
   REAL-TIME LISTENERS
   =========================== */

export const subscribeToClubs = (callback) => {
  return onSnapshot(collection(db, 'clubs'), (snapshot) => {
    const clubs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(clubs);
  });
};

export const subscribeToClub = (clubId, callback) => {
  return onSnapshot(doc(db, 'clubs', clubId), (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() });
    }
  });
};

export const subscribeToEvents = (callback) => {
  return onSnapshot(collection(db, 'events'), (snapshot) => {
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(events);
  });
};

export const subscribeToRequests = (callback) => {
  const q = query(collection(db, 'requests'), where('status', '==', 'pending'));
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(requests);
  });
};

/* ===========================
   UTILITY FUNCTIONS
   =========================== */

export const generateUniqueCode = async () => {
  // Generate a 6-digit code
  for (let tries = 0; tries < 100; tries++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await getClubByCode(code);
    if (!existing) return code;
  }
  // Fallback to random string
  return Math.random().toString(36).slice(2, 8).toUpperCase();
};

/* ===========================
   ORDERS COLLECTION - ADD TO firestore.js
   =========================== */

// Create order template
export const createOrderTemplate = async (orderData) => {
  try {
    const docRef = await addDoc(collection(db, 'orderTemplates'), {
      ...orderData,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...orderData };
  } catch (error) {
    console.error('Error creating order template:', error);
    throw error;
  }
};

// Get order template
export const getOrderTemplate = async (orderId) => {
  try {
    const orderDoc = await getDoc(doc(db, 'orderTemplates', orderId));
    if (orderDoc.exists()) {
      return { id: orderDoc.id, ...orderDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting order template:', error);
    throw error;
  }
};

// Update order template
export const updateOrderTemplate = async (orderId, updates) => {
  try {
    await updateDoc(doc(db, 'orderTemplates', orderId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating order template:', error);
    throw error;
  }
};

// Delete order template
export const deleteOrderTemplate = async (orderId) => {
  try {
    await deleteDoc(doc(db, 'orderTemplates', orderId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting order template:', error);
    throw error;
  }
};

// Get all order templates for a club
export const getClubOrderTemplates = async (clubId) => {
  try {
    const q = query(
      collection(db, 'orderTemplates'),
      where('clubId', '==', clubId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting club order templates:', error);
    throw error;
  }
};

// Get user's pending orders (orders they need to respond to)
export const getUserPendingOrders = async (userId) => {
  try {
    // Get all user's clubs
    const userClubs = await getUserClubs(userId);
    const clubIds = userClubs.map(c => c.id);
    
    if (clubIds.length === 0) return [];
    
    // Get all active orders from user's clubs
    const q = query(
      collection(db, 'orderTemplates'),
      where('clubId', 'in', clubIds.slice(0, 10)), // Firestore 'in' limit is 10
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter orders user hasn't responded to
    const pendingOrders = [];
    for (const order of orders) {
      const responseExists = await checkUserOrderResponse(order.id, userId);
      if (!responseExists) {
        pendingOrders.push(order);
      }
    }
    
    return pendingOrders;
  } catch (error) {
    console.error('Error getting user pending orders:', error);
    throw error;
  }
};

// Create order response
export const createOrderResponse = async (responseData) => {
  try {
    const docRef = await addDoc(collection(db, 'orderResponses'), {
      ...responseData,
      submittedAt: serverTimestamp()
    });
    return { id: docRef.id, ...responseData };
  } catch (error) {
    console.error('Error creating order response:', error);
    throw error;
  }
};

// Get order response
export const getOrderResponse = async (responseId) => {
  try {
    const responseDoc = await getDoc(doc(db, 'orderResponses', responseId));
    if (responseDoc.exists()) {
      return { id: responseDoc.id, ...responseDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting order response:', error);
    throw error;
  }
};

// Update order response
export const updateOrderResponse = async (responseId, updates) => {
  try {
    await updateDoc(doc(db, 'orderResponses', responseId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating order response:', error);
    throw error;
  }
};

// Get all responses for an order
export const getOrderResponses = async (orderId) => {
  try {
    const q = query(
      collection(db, 'orderResponses'),
      where('orderId', '==', orderId),
      orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting order responses:', error);
    throw error;
  }
};

// Check if user has responded to an order
export const checkUserOrderResponse = async (orderId, userId) => {
  try {
    const q = query(
      collection(db, 'orderResponses'),
      where('orderId', '==', orderId),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking user order response:', error);
    return false;
  }
};

// Get order statistics
export const getOrderStatistics = async (orderId) => {
  try {
    const responses = await getOrderResponses(orderId);
    
    const stats = {
      total: responses.length,
      accepted: responses.filter(r => r.status === 'accepted').length,
      declined: responses.filter(r => r.status === 'declined').length,
      pending: 0 // Will be calculated based on eligible users
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting order statistics:', error);
    throw error;
  }
};

export default {
  // Users
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  getAllUsers,
  deleteUser,
  
  // Clubs
  createClub,
  getClub,
  getClubByCode,
  updateClub,
  getAllClubs,
  getUserClubs,
  deleteClub,
  
  // Events
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  getClubEvents,
  getTeamEvents,
  getUserEvents,
  updateEventResponse,
  
  // Requests
  createRequest,
  getRequest,
  updateRequest,
  getPendingRequests,
  deleteRequest,
  
  // Real-time
  subscribeToClubs,
  subscribeToClub,
  subscribeToEvents,
  subscribeToRequests,
  
  // Utilities
  generateUniqueCode,

    // Orders
  createOrderTemplate,
  getOrderTemplate,
  updateOrderTemplate,
  deleteOrderTemplate,
  getClubOrderTemplates,
  getUserPendingOrders,
  createOrderResponse,
  getOrderResponse,
  updateOrderResponse,
  getOrderResponses,
  checkUserOrderResponse,
  getOrderStatistics
  
};
