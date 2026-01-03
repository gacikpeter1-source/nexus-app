// src/firebase/feedback.js
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { getEvent } from './firestore';

/**
 * Submit or update event feedback
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID
 * @param {Object} feedbackData - { rating, comment, clubId, teamId }
 * @returns {Promise<void>}
 */
export const submitEventFeedback = async (eventId, userId, feedbackData) => {
  try {
    const { rating, comment = '', clubId, teamId } = feedbackData;

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const feedbackId = `${eventId}_${userId}`;
    const feedbackRef = doc(db, 'eventFeedback', feedbackId);

    // Check if feedback already exists
    const existingFeedback = await getDoc(feedbackRef);
    const isUpdate = existingFeedback.exists();

    const feedback = {
      eventId,
      userId,
      clubId,
      teamId,
      rating,
      comment,
      updatedAt: serverTimestamp(),
    };

    if (!isUpdate) {
      feedback.createdAt = serverTimestamp();
    }

    await setDoc(feedbackRef, feedback, { merge: true });

    console.log(`✅ Event feedback ${isUpdate ? 'updated' : 'submitted'}:`, feedbackId);
    return feedbackId;
  } catch (error) {
    console.error('❌ Error submitting feedback:', error);
    throw error;
  }
};

/**
 * Get user's feedback for an event
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>}
 */
export const getUserFeedback = async (eventId, userId) => {
  try {
    const feedbackId = `${eventId}_${userId}`;
    const feedbackRef = doc(db, 'eventFeedback', feedbackId);
    const feedbackSnap = await getDoc(feedbackRef);

    if (feedbackSnap.exists()) {
      return {
        id: feedbackSnap.id,
        ...feedbackSnap.data(),
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting user feedback:', error);
    throw error;
  }
};

/**
 * Get all feedback for an event
 * @param {string} eventId - Event ID
 * @returns {Promise<Array>}
 */
export const getEventFeedback = async (eventId) => {
  try {
    const feedbackQuery = query(
      collection(db, 'eventFeedback'),
      where('eventId', '==', eventId)
    );

    const feedbackSnap = await getDocs(feedbackQuery);
    const feedback = feedbackSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`📊 Retrieved ${feedback.length} feedback entries for event ${eventId}`);
    return feedback;
  } catch (error) {
    console.error('❌ Error getting event feedback:', error);
    throw error;
  }
};

/**
 * Calculate average rating for an event
 * @param {string} eventId - Event ID
 * @returns {Promise<Object>} - { averageRating, totalResponses }
 */
export const getEventRating = async (eventId) => {
  try {
    const feedback = await getEventFeedback(eventId);

    if (feedback.length === 0) {
      return { averageRating: 0, totalResponses: 0 };
    }

    const totalRating = feedback.reduce((sum, f) => sum + f.rating, 0);
    const averageRating = totalRating / feedback.length;

    return {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalResponses: feedback.length,
    };
  } catch (error) {
    console.error('❌ Error calculating event rating:', error);
    throw error;
  }
};

/**
 * Get feedback statistics for a team
 * @param {string} teamId - Team ID
 * @param {Date} startDate - Start date (optional)
 * @param {Date} endDate - End date (optional)
 * @returns {Promise<Array>}
 */
export const getTeamFeedbackStats = async (teamId, startDate = null, endDate = null) => {
  try {
    let feedbackQuery = query(
      collection(db, 'eventFeedback'),
      where('teamId', '==', teamId)
    );

    const feedbackSnap = await getDocs(feedbackQuery);
    let feedback = feedbackSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter by date range if provided
    if (startDate || endDate) {
      feedback = feedback.filter((f) => {
        const feedbackDate = f.createdAt?.toDate();
        if (!feedbackDate) return false;

        if (startDate && feedbackDate < startDate) return false;
        if (endDate && feedbackDate > endDate) return false;

        return true;
      });
    }

    // Group by event
    const eventStats = {};
    feedback.forEach((f) => {
      if (!eventStats[f.eventId]) {
        eventStats[f.eventId] = {
          eventId: f.eventId,
          clubId: f.clubId,
          teamId: f.teamId,
          ratings: [],
        };
      }
      eventStats[f.eventId].ratings.push(f.rating);
    });

    // Calculate averages
    const stats = Object.values(eventStats).map((stat) => {
      const totalRating = stat.ratings.reduce((sum, r) => sum + r, 0);
      const averageRating = totalRating / stat.ratings.length;

      return {
        ...stat,
        averageRating: Math.round(averageRating * 10) / 10,
        totalResponses: stat.ratings.length,
      };
    });

    console.log(`📊 Retrieved feedback stats for ${stats.length} events in team ${teamId}`);
    return stats;
  } catch (error) {
    console.error('❌ Error getting team feedback stats:', error);
    throw error;
  }
};

/**
 * Delete user's feedback
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const deleteFeedback = async (eventId, userId) => {
  try {
    const feedbackId = `${eventId}_${userId}`;
    const feedbackRef = doc(db, 'eventFeedback', feedbackId);

    await deleteDoc(feedbackRef);

    console.log('✅ Feedback deleted:', feedbackId);
  } catch (error) {
    console.error('❌ Error deleting feedback:', error);
    throw error;
  }
};

/**
 * Get aggregated ratings for a training plan
 * @param {string} trainingPlanId - Training plan ID
 * @returns {Promise<Object>} - { averageRating, totalResponses, usageCount }
 */
export const getTrainingPlanRating = async (trainingPlanId) => {
  try {
    // We need to:
    // 1. Find all events that used this training plan
    // 2. Get feedback for those events
    // 3. Aggregate the ratings
    
    // Import getEvent to fetch events
    const { getEvent, getAllEvents } = await import('./firestore');
    
    // Get all events (we'll need to query by training plan usage)
    // Note: This is a simplification. In production, you'd want a more efficient query
    const eventsRef = collection(db, 'events');
    const eventsSnap = await getDocs(eventsRef);
    
    // Filter events that have this training plan attached
    const eventsWithTraining = [];
    eventsSnap.docs.forEach(doc => {
      const eventData = doc.data();
      if (eventData.attachedTrainings && 
          eventData.attachedTrainings.some(t => t.id === trainingPlanId)) {
        eventsWithTraining.push(doc.id);
      }
    });

    if (eventsWithTraining.length === 0) {
      return { averageRating: 0, totalResponses: 0, usageCount: 0 };
    }

    // Get feedback for all these events
    const allFeedback = [];
    await Promise.all(
      eventsWithTraining.map(async (eventId) => {
        const feedback = await getEventFeedback(eventId);
        allFeedback.push(...feedback);
      })
    );

    if (allFeedback.length === 0) {
      return { averageRating: 0, totalResponses: 0, usageCount: eventsWithTraining.length };
    }

    // Calculate average
    const totalRating = allFeedback.reduce((sum, f) => sum + f.rating, 0);
    const averageRating = totalRating / allFeedback.length;

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalResponses: allFeedback.length,
      usageCount: eventsWithTraining.length,
    };
  } catch (error) {
    console.error('❌ Error getting training plan rating:', error);
    return { averageRating: 0, totalResponses: 0, usageCount: 0 };
  }
};

/**
 * Get ratings for multiple training plans
 * @param {Array<string>} trainingPlanIds - Array of training plan IDs
 * @returns {Promise<Object>} - { trainingPlanId: { averageRating, totalResponses, usageCount } }
 */
export const getMultipleTrainingPlanRatings = async (trainingPlanIds) => {
  try {
    const ratings = {};
    
    await Promise.all(
      trainingPlanIds.map(async (id) => {
        ratings[id] = await getTrainingPlanRating(id);
      })
    );

    return ratings;
  } catch (error) {
    console.error('❌ Error getting multiple training plan ratings:', error);
    return {};
  }
};

