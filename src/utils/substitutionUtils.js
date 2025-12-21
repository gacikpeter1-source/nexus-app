// src/utils/substitutionUtils.js
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

/**
 * Request a substitute for an event
 * @param {string} eventId - Event ID
 * @param {string} originalUserId - User requesting substitution
 * @param {string} substituteUserId - Selected substitute
 * @param {boolean} fromWaitlist - Whether substitute is from waitlist
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function requestSubstitute(eventId, originalUserId, substituteUserId, fromWaitlist = false) {
  try {
    const requestSubstituteFunc = httpsCallable(functions, 'requestSubstitute');
    const result = await requestSubstituteFunc({
      eventId,
      originalUserId,
      substituteUserId,
      fromWaitlist
    });
    return result.data;
  } catch (error) {
    console.error('Error requesting substitute:', error);
    throw error;
  }
}

/**
 * Accept or reject a substitution request
 * @param {string} substitutionId - Substitution request ID
 * @param {string} action - 'accept' or 'reject'
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function respondToSubstitution(substitutionId, action) {
  try {
    const respondToSubstitutionFunc = httpsCallable(functions, 'respondToSubstitution');
    const result = await respondToSubstitutionFunc({
      substitutionId,
      action
    });
    return result.data;
  } catch (error) {
    console.error('Error responding to substitution:', error);
    throw error;
  }
}

/**
 * Trainer manually swaps users (active <-> waitlist)
 * @param {string} eventId - Event ID
 * @param {string} user1Id - First user ID
 * @param {string} user2Id - Second user ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function trainerSwapUsers(eventId, user1Id, user2Id) {
  try {
    const trainerSwapFunc = httpsCallable(functions, 'trainerSwapUsers');
    const result = await trainerSwapFunc({
      eventId,
      user1Id,
      user2Id
    });
    return result.data;
  } catch (error) {
    console.error('Error swapping users:', error);
    throw error;
  }
}

/**
 * Get pending substitution requests for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of pending substitution requests
 */
export async function getPendingSubstitutions(userId) {
  try {
    const getPendingFunc = httpsCallable(functions, 'getPendingSubstitutions');
    const result = await getPendingFunc({ userId });
    return result.data.substitutions || [];
  } catch (error) {
    console.error('Error getting pending substitutions:', error);
    return [];
  }
}

