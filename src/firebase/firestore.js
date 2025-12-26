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
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

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

export const setUserRole = async (userId, role, isSuperAdmin = false) => {
  const functions = getFunctions();
  const setCustomClaims = httpsCallable(functions, 'setCustomClaims');
  await setCustomClaims({ userId, role, isSuperAdmin });
};

export const getUserByEmail = async (email) => {
  try {
    if (!email) return null;
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

// DEPRECATED: Use getUserClubs() instead
// This function cannot work with security rules that require user membership
// Get all clubs - Used by admin/manager pages only
// Get all clubs - Admins see all, others see only their clubs
export const getAllClubs = async (userId = null, isAdmin = false) => {
  try {
    // If no userId provided, try to get all clubs (admin only)
    if (!userId) {
      const snapshot = await getDocs(collection(db, 'clubs'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    if (isAdmin) {
      // Admin: get all clubs
      const snapshot = await getDocs(collection(db, 'clubs'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      // Non-admin: get only user's clubs
      return await getUserClubs(userId);
    }
  } catch (error) {
    console.error('Error getting clubs:', error);
    throw error;
  }
};

// Get clubs for a specific user using proper queries
export const getUserClubs = async (userId) => {
  try {
    if (!userId) {
      console.error('getUserClubs: userId is required');
      return [];
    }

        // Check if user is admin - if so, return ALL clubs
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.isSuperAdmin === true || userData.role === 'admin') {
        const snapshot = await getDocs(collection(db, 'clubs'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    }

    const clubsRef = collection(db, 'clubs');
    const clubs = [];
    
    // Query for clubs where user is a member
    const memberQuery = query(clubsRef, where('members', 'array-contains', userId));
    const memberSnapshot = await getDocs(memberQuery);
    memberSnapshot.forEach(doc => {
      clubs.push({ id: doc.id, ...doc.data() });
    });
    
    // Query for clubs where user is a trainer
    const trainerQuery = query(clubsRef, where('trainers', 'array-contains', userId));
    const trainerSnapshot = await getDocs(trainerQuery);
    trainerSnapshot.forEach(doc => {
      // Check if not already added
      if (!clubs.find(c => c.id === doc.id)) {
        clubs.push({ id: doc.id, ...doc.data() });
      }
    });
    
    // Query for clubs where user is an assistant
    const assistantQuery = query(clubsRef, where('assistants', 'array-contains', userId));
    const assistantSnapshot = await getDocs(assistantQuery);
    assistantSnapshot.forEach(doc => {
      // Check if not already added
      if (!clubs.find(c => c.id === doc.id)) {
        clubs.push({ id: doc.id, ...doc.data() });
      }
    });
    
    return clubs;
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
export const updateEventResponse = async (eventId, userId, status, message = null) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await getDoc(eventRef);
    
    if (!eventDoc.exists()) {
      throw new Error('Event not found');
    }

    const eventData = eventDoc.data();
    const currentResponses = eventData.responses || {};
    
    // Check if user should go to waitlist
    let finalStatus = status;
    if (status === 'attending' && eventData.participantLimit) {
      // Count current attending users
      const attendingCount = Object.values(currentResponses)
        .filter(r => r.status === 'attending')
        .length;
      
      // If event is full, set status to 'waiting' instead
      if (attendingCount >= eventData.participantLimit) {
        finalStatus = 'waiting';
      }
    }
    
    // Build response object
    const responseData = {
      status: finalStatus,
      timestamp: serverTimestamp()
    };
    
    // Only add message field if it exists
    if (message && message.trim()) {
      responseData.message = message.trim();
    }
    
    const updatedResponses = {
      ...currentResponses,
      [userId]: responseData
    };

    // Clear waitlistNotified if user is no longer waiting
    if (finalStatus !== 'waiting' && currentResponses[userId]?.waitlistNotified) {
      delete updatedResponses[userId].waitlistNotified;
      delete updatedResponses[userId].notifiedAt;
    }

    await updateDoc(eventRef, {
      responses: updatedResponses,
      updatedAt: serverTimestamp()
    });

    // NEW: Clear pending notifications when status changes
    if (currentResponses[userId]?.status !== finalStatus) {
      // Status changed - clear any pending notifications
      const pendingRef = collection(db, 'pendingNotifications');
      const pendingQuery = query(
        pendingRef,
        where('eventId', '==', eventId),
        where('userId', '==', userId)
      );
      const pendingSnap = await getDocs(pendingQuery);
      
      const deletePromises = pendingSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating event response:', error);
    throw error;
  }
};


// Get all events for a user (where they're a member of the team/club OR invited)
export const getUserEvents = async (userId) => {
  try {
    // Get user's clubs directly (no getAllClubs call)
    const userClubs = await getUserClubs(userId);

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
    
    // Get user's team memberships
    const userTeamIds = [];
    for (const club of userClubs) {
      // Get full club data with teams
      const fullClub = await getClub(club.id);
      if (fullClub && fullClub.teams) {
        for (const team of fullClub.teams) {
          if ((team.members || []).includes(userId) ||
              (team.trainers || []).includes(userId) ||
              (team.assistants || []).includes(userId)) {
            userTeamIds.push(team.id);
          }
        }
      }
    }
    
    // Filter orders user hasn't responded to AND is eligible for
    const pendingOrders = [];
    for (const order of orders) {
      // Check if user already responded
      const responseExists = await checkUserOrderResponse(order.id, userId);
      if (responseExists) continue;
      
      // Check if user is eligible for this order
      // If order.teams is empty or length === 0 → show to all club members
      // If order.teams has specific teams → only show if user is in those teams
      if (!order.teams || order.teams.length === 0) {
        // All teams - show to all club members
        pendingOrders.push(order);
      } else {
        // Specific teams - check if user is in any of them
        const isInTeam = order.teams.some(teamId => userTeamIds.includes(teamId));
        if (isInTeam) {
          pendingOrders.push(order);
        }
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

/* ===========================
   SUBSCRIPTION FUNCTIONS
   =========================== */

// Get user's subscription
export const getUserSubscription = async (userId) => {
  try {
    const q = query(
      collection(db, 'subscriptions'),
      where('userId', '==', userId),
      where('clubId', '==', null),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return null;
  }
};

// Get club's subscription
export const getClubSubscription = async (clubId) => {
  try {
    const q = query(
      collection(db, 'subscriptions'),
      where('clubId', '==', clubId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting club subscription:', error);
    return null;
  }
};

// Get subscription by ID
export const getSubscription = async (subscriptionId) => {
  try {
    const docRef = doc(db, 'subscriptions', subscriptionId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error('Error getting subscription:', error);
    return null;
  }
};

// Create subscription
export const createSubscription = async (subscriptionData) => {
  try {
    const docRef = await addDoc(collection(db, 'subscriptions'), {
      ...subscriptionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    return { id: docRef.id, ...subscriptionData };
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

// Update subscription
export const updateSubscription = async (subscriptionId, updates) => {
  try {
    const docRef = doc(db, 'subscriptions', subscriptionId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    return { id: subscriptionId, ...updates };
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
};

// Cancel subscription
export const cancelSubscription = async (subscriptionId) => {
  try {
    await updateSubscription(subscriptionId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }
};

/* ===========================
   INVOICE FUNCTIONS
   =========================== */

// Create invoice
export const createInvoice = async (invoiceData) => {
  try {
    const docRef = await addDoc(collection(db, 'invoices'), {
      ...invoiceData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    return { id: docRef.id, ...invoiceData };
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
};

// Get invoice
export const getInvoice = async (invoiceId) => {
  try {
    const docRef = doc(db, 'invoices', invoiceId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error('Error getting invoice:', error);
    return null;
  }
};

// Update invoice
export const updateInvoice = async (invoiceId, updates) => {
  try {
    const docRef = doc(db, 'invoices', invoiceId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    return { id: invoiceId, ...updates };
  } catch (error) {
    console.error('Error updating invoice:', error);
    throw error;
  }
};

// Get all invoices (admin only)
export const getAllInvoices = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'invoices'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting invoices:', error);
    return [];
  }
};

// Get user invoices
export const getUserInvoices = async (userId) => {
  try {
    const q = query(
      collection(db, 'invoices'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting user invoices:', error);
    return [];
  }
};

// Send invoice email
export const sendInvoiceEmail = async (invoice) => {
  try {
    await addDoc(collection(db, 'emailQueue'), {
      to: invoice.customerEmail,
      template: 'invoice',
      data: {
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        planName: invoice.planName,
        amount: invoice.total,
        dueDate: invoice.dueDate
      },
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
    
    console.log('Invoice email queued');
  } catch (error) {
    console.error('Error sending invoice email:', error);
    throw error;
  }
};

/* ===========================
   VOUCHER FUNCTIONS
   =========================== */

// Create voucher (admin only)
export const createVoucher = async (voucherData) => {
  try {
    const docRef = await addDoc(collection(db, 'vouchers'), {
      ...voucherData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    return { id: docRef.id, ...voucherData };
  } catch (error) {
    console.error('Error creating voucher:', error);
    throw error;
  }
};

// Get all vouchers (admin only)
export const getAllVouchers = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'vouchers'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting vouchers:', error);
    return [];
  }
};

// Validate voucher code
export const validateVoucher = async (code) => {
  try {
    const q = query(
      collection(db, 'vouchers'),
      where('code', '==', code.toUpperCase()),
      where('status', '==', 'active'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { valid: false, reason: 'Voucher code not found' };
    }
    
    const voucher = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    
    // Check expiration
    if (new Date(voucher.expirationDate) < new Date()) {
      return { valid: false, reason: 'Voucher has expired' };
    }
    
    // Check max uses
    if (voucher.usedCount >= voucher.maxUses) {
      return { valid: false, reason: 'Voucher has reached maximum uses' };
    }
    
    // Plan names
    const planNames = {
      trial: 'Trial (All Features)',
      user: 'User Subscription',
      club: 'Club Subscription',
      full: 'Full Subscription'
    };
    
    return {
      valid: true,
      id: voucher.id,
      code: voucher.code,
      plan: voucher.plan,
      planName: planNames[voucher.plan] || voucher.plan,
      duration: voucher.duration,
      expirationDate: voucher.expirationDate,
      usesRemaining: voucher.maxUses - voucher.usedCount
    };
  } catch (error) {
    console.error('Error validating voucher:', error);
    return { valid: false, reason: 'Error validating voucher' };
  }
};

// Redeem voucher
export const redeemVoucher = async (voucherId, userId, clubId = null) => {
  try {
    const voucherRef = doc(db, 'vouchers', voucherId);
    const voucherDoc = await getDoc(voucherRef);
    
    if (!voucherDoc.exists()) {
      throw new Error('Voucher not found');
    }
    
    const voucher = voucherDoc.data();
    
    await updateDoc(voucherRef, {
      usedCount: (voucher.usedCount || 0) + 1,
      usedBy: [...(voucher.usedBy || []), {
        userId,
        clubId,
        redeemedAt: new Date().toISOString()
      }],
      updatedAt: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('Error redeeming voucher:', error);
    throw error;
  }
};

// Delete voucher (admin only)
export const deleteVoucher = async (voucherId) => {
  try {
    await deleteDoc(doc(db, 'vouchers', voucherId));
  } catch (error) {
    console.error('Error deleting voucher:', error);
    throw error;
  }
};

// Get voucher by code
export const getVoucherByCode = async (code) => {
  try {
    const q = query(
      collection(db, 'vouchers'),
      where('code', '==', code.toUpperCase()),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    console.error('Error getting voucher by code:', error);
    return null;
  }
};

/* ===========================
   ADDITIONAL CHAT SYSTEM FUNCTIONS
   =========================== */

// Get all clubs (for chat member selection)
export const getClubs = async () => {
  try {
    const clubsRef = collection(db, 'clubs');
    const querySnapshot = await getDocs(clubsRef);
    const clubs = [];
    querySnapshot.forEach((doc) => {
      clubs.push({ id: doc.id, ...doc.data() });
    });
    return clubs;
  } catch (error) {
    console.error('Error getting clubs:', error);
    throw error;
  }
};

// Get multiple users by IDs (for chat member details)
export const getUsersByIds = async (userIds) => {
  try {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    const users = [];
    // Firestore 'in' queries are limited to 10 items, so we need to batch
    const chunks = [];
    for (let i = 0; i < userIds.length; i += 10) {
      chunks.push(userIds.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('__name__', 'in', chunk));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
    }

    return users;
  } catch (error) {
    console.error('Error getting users by IDs:', error);
    throw error;
  }
};

export const createAttendance = async (attendanceData) => {
  try {
    const docRef = await addDoc(collection(db, 'attendance'), {
      ...attendanceData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating attendance:', error);
    throw error;
  }
};

/**
 * Get attendance by ID
 */
export const getAttendance = async (attendanceId) => {
  try {
    const attendanceDoc = await getDoc(doc(db, 'attendance', attendanceId));
    if (attendanceDoc.exists()) {
      return { id: attendanceDoc.id, ...attendanceDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting attendance:', error);
    throw error;
  }
};

/**
 * Get all attendance records for a team
 */
export const getTeamAttendance = async (teamId) => {
  try {
    const q = query(
      collection(db, 'attendance'),
      where('teamId', '==', teamId),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting team attendance:', error);
    throw error;
  }
};

/**
 * Get attendance by date - Returns ALL attendance records for that date
 */
export const getAttendanceByDate = async (teamId, date) => {
  try {
    const q = query(
      collection(db, 'attendance'),
      where('teamId', '==', teamId),
      where('date', '==', date),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting attendance by date:', error);
    throw error;
  }
};

/**
 * Update attendance record
 */
export const updateAttendance = async (attendanceId, data) => {
  try {
    await updateDoc(doc(db, 'attendance', attendanceId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    throw error;
  }
};

/**
 * Delete attendance record
 */
export const deleteAttendance = async (attendanceId) => {
  try {
    await deleteDoc(doc(db, 'attendance', attendanceId));
  } catch (error) {
    console.error('Error deleting attendance:', error);
    throw error;
  }
};

/**
 * Get attendance statistics for a team
 */
export const getTeamAttendanceStats = async (teamId, startDate = null, endDate = null) => {
  try {
    let q = query(
      collection(db, 'attendance'),
      where('teamId', '==', teamId)
    );

    if (startDate && endDate) {
      q = query(q, 
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
    }

    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate statistics
    const totalSessions = records.length;
    let totalPresent = 0;
    let totalAbsent = 0;
    const userStats = {};

    records.forEach(record => {
      totalPresent += record.statistics?.present || 0;
      totalAbsent += record.statistics?.absent || 0;

      // Per-user stats
      record.records.forEach(r => {
        if (!userStats[r.userId]) {
          userStats[r.userId] = { present: 0, absent: 0, total: 0 };
        }
        userStats[r.userId].total++;
        if (r.present) {
          userStats[r.userId].present++;
        } else {
          userStats[r.userId].absent++;
        }
      });
    });

    return {
      totalSessions,
      totalPresent,
      totalAbsent,
      averageAttendance: totalSessions > 0 ? (totalPresent / (totalPresent + totalAbsent) * 100).toFixed(1) : 0,
      userStats
    };
  } catch (error) {
    console.error('Error getting attendance stats:', error);
    throw error;
  }
};

/* ===========================
   USER PROFILE
   =========================== */

// Update user member profile
export const updateUserMemberProfile = async (userId, profileData) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...profileData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/* ===========================
   TEAM MEMBER CARDS & BADGES
   =========================== */

// Update team card settings (colors, stats, images)
export const updateTeamCardSettings = async (clubId, teamId, settings) => {
  try {
    const clubRef = doc(db, 'clubs', clubId);
    const clubDoc = await getDoc(clubRef);
    
    if (!clubDoc.exists()) {
      throw new Error('Club not found');
    }

    const clubData = clubDoc.data();
    const teams = clubData.teams || [];
    const teamIndex = teams.findIndex(t => t.id === teamId);

    if (teamIndex === -1) {
      throw new Error('Team not found');
    }

    // Build update object, only including defined values
    const updates = {
      ...teams[teamIndex],
      updatedAt: new Date().toISOString()
    };

    // Only add fields if they're actually provided (not undefined)
    if (settings.cardSettings !== undefined) {
      updates.cardSettings = settings.cardSettings;
    }
    if (settings.customStats !== undefined) {
      updates.customStats = settings.customStats;
    }
    if (settings.customFields !== undefined) {
      updates.customFields = settings.customFields;
    }
    if (settings.badgeSettings !== undefined) {
      updates.badgeSettings = settings.badgeSettings;
    }
    if (settings.positions !== undefined) {
      updates.positions = settings.positions;
    }
    if (settings.statsTemplate !== undefined) {
      updates.statsTemplate = settings.statsTemplate;
    }

    teams[teamIndex] = updates;

    await updateDoc(clubRef, { teams });
    return true;
  } catch (error) {
    console.error('Error updating team card settings:', error);
    throw error;
  }
};

// Update team member data (team-specific profile)
export const updateTeamMemberData = async (clubId, teamId, userId, memberData) => {
  try {
    const clubRef = doc(db, 'clubs', clubId);
    const clubDoc = await getDoc(clubRef);
    
    if (!clubDoc.exists()) {
      throw new Error('Club not found');
    }

    const clubData = clubDoc.data();
    const teams = clubData.teams || [];
    const teamIndex = teams.findIndex(t => t.id === teamId);

    if (teamIndex === -1) {
      throw new Error('Team not found');
    }

    if (!teams[teamIndex].memberData) {
      teams[teamIndex].memberData = {};
    }

    teams[teamIndex].memberData[userId] = {
      ...teams[teamIndex].memberData[userId],
      ...memberData,
      updatedAt: new Date().toISOString()
    };

    teams[teamIndex].updatedAt = new Date().toISOString();

    await updateDoc(clubRef, { teams });
    return true;
  } catch (error) {
    console.error('Error updating team member data:', error);
    throw error;
  }
};

// Get user stats for card display
export const getUserStats = async (userId, teamId) => {
  try {
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('teamId', '==', teamId)
    );
    
    const attendanceSnap = await getDocs(attendanceQuery);
    let totalSessions = 0;
    let present = 0;

    attendanceSnap.forEach(doc => {
      const data = doc.data();
      const userRecord = data.records?.find(r => r.userId === userId);
      if (userRecord) {
        totalSessions++;
        if (userRecord.present) present++;
      }
    });

    const attendanceRate = totalSessions > 0 
      ? Math.round((present / totalSessions) * 100) 
      : 0;

    return {
      games: totalSessions,
      attendance: attendanceRate,
      years: 1,
      goals: 0,
      assists: 0,
      points: 0
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return {
      games: 0,
      attendance: 0,
      years: 0
    };
  }
};

// Update team badge settings
export const updateTeamBadgeSettings = async (clubId, teamIndex, badgeSettings) => {
  try {
    const clubRef = doc(db, 'clubs', clubId);
    const clubDoc = await getDoc(clubRef);
    
    if (!clubDoc.exists()) {
      throw new Error('Club not found');
    }

    const clubData = clubDoc.data();
    const teams = clubData.teams || [];
    
    if (teamIndex < 0 || teamIndex >= teams.length) {
      throw new Error('Team not found');
    }

    teams[teamIndex] = {
      ...teams[teamIndex],
      badgeSettings: {
        ...badgeSettings,
        updatedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };

    await updateDoc(clubRef, { teams });
    return true;
  } catch (error) {
    console.error('Error updating badge settings:', error);
    throw error;
  }
};

// Get team badge settings
export const getTeamBadgeSettings = async (clubId, teamIndex) => {
  try {
    const clubRef = doc(db, 'clubs', clubId);
    const clubDoc = await getDoc(clubRef);
    
    if (!clubDoc.exists()) {
      throw new Error('Club not found');
    }

    const clubData = clubDoc.data();
    const teams = clubData.teams || [];
    
    if (teamIndex < 0 || teamIndex >= teams.length) {
      throw new Error('Team not found');
    }

    return teams[teamIndex].badgeSettings || {
      enabled: false,
      displayDuration: 'permanent',
      rules: []
    };
  } catch (error) {
    console.error('Error getting badge settings:', error);
    throw error;
  }
};

// Calculate member badges based on stats and rules
export const calculateMemberBadges = (memberStats, badgeSettings) => {
  if (!badgeSettings?.enabled || !badgeSettings?.rules?.length) {
    return [];
  }

  const earnedBadges = [];
  const badgeOrder = ['iron', 'bronze', 'silver', 'gold', 'platinum'];

  badgeSettings.rules.forEach(rule => {
    const statValue = memberStats[rule.criteria.stat];
    const ruleValue = parseFloat(rule.criteria.value);
    
    if (statValue === undefined || isNaN(ruleValue)) return;

    let qualifies = false;
    
    switch (rule.criteria.operator) {
      case 'gte':
        qualifies = statValue >= ruleValue;
        break;
      case 'lte':
        qualifies = statValue <= ruleValue;
        break;
      case 'eq':
        qualifies = statValue === ruleValue;
        break;
      default:
        break;
    }

    if (qualifies) {
      earnedBadges.push({
        name: rule.name,
        badge: rule.badge,
        earnedAt: new Date().toISOString(),
        displayDuration: badgeSettings.displayDuration
      });
    }
  });

  earnedBadges.sort((a, b) => {
    const aIndex = badgeOrder.indexOf(a.badge);
    const bIndex = badgeOrder.indexOf(b.badge);
    return bIndex - aIndex;
  });

  return earnedBadges.slice(0, 3);
};

    export const setUserCustomClaims = async (userId, role, isSuperAdmin = false) => {
      const functions = getFunctions();
      const setCustomClaims = httpsCallable(functions, 'setCustomClaims');
      const result = await setCustomClaims({ userId, role, isSuperAdmin });
      return result.data;
    };

export default {
  // Users
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  getAllUsers,
  getUsersByIds,
  deleteUser,
  updateUserMemberProfile,
  
  // Clubs
  createClub,
  getClub,
  getClubByCode,
  updateClub,
  getAllClubs,
  getUserClubs,
  getClubs,
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
  getOrderStatistics,

    // Subscription functions
  getUserSubscription,
  getClubSubscription,
  getSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  
  // Invoice functions
  createInvoice,
  getInvoice,
  updateInvoice,
  getAllInvoices,
  getUserInvoices,
  sendInvoiceEmail,
  
  // Voucher functions
  createVoucher,
  getAllVouchers,
  validateVoucher,
  redeemVoucher,
  deleteVoucher,
  getVoucherByCode,

    // Attendance functions
  createAttendance,
  getAttendance,
  getTeamAttendance,
  getAttendanceByDate,
  updateAttendance,
  deleteAttendance,
  getTeamAttendanceStats,
  
  // Team Member Cards & Badges
  updateTeamCardSettings,
  updateTeamMemberData,
  getUserStats,
  updateTeamBadgeSettings,
  getTeamBadgeSettings,
  calculateMemberBadges,
  
  // Training Library functions
  createTraining,
  getTraining,
  getTrainerTrainings,
  updateTraining,
  deleteTraining,
  
};

/* ===========================
   TRAINING LIBRARY
   =========================== */

// Create a new training
export async function createTraining(trainingData) {
  try {
    const trainingRef = await addDoc(collection(db, 'trainings'), {
      ...trainingData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      statistics: {
        timesUsed: 0,
        eventsUsed: [],
        totalParticipants: 0
      }
    });
    return { id: trainingRef.id, ...trainingData };
  } catch (error) {
    console.error('Error creating training:', error);
    throw error;
  }
}

// Get single training by ID
export async function getTraining(trainingId) {
  try {
    const trainingDoc = await getDoc(doc(db, 'trainings', trainingId));
    if (trainingDoc.exists()) {
      return { id: trainingDoc.id, ...trainingDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting training:', error);
    throw error;
  }
}

// Get all trainings for a trainer
export async function getTrainerTrainings(trainerId) {
  try {
    const q = query(
      collection(db, 'trainings'),
      where('ownerId', '==', trainerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting trainer trainings:', error);
    throw error;
  }
}

// Update training
export async function updateTraining(trainingId, updates) {
  try {
    await updateDoc(doc(db, 'trainings', trainingId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating training:', error);
    throw error;
  }
}

// Delete training
export async function deleteTraining(trainingId) {
  try {
    await deleteDoc(doc(db, 'trainings', trainingId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting training:', error);
    throw error;
  }
}
