// src/utils/userManagementNotifications.js
// Utility functions to trigger user management notifications

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

/**
 * Notify user they were added to a club or team
 * @param {string} userId - User ID
 * @param {string} clubId - Club ID  
 * @param {string} clubName - Club name
 * @param {string} teamId - Team ID (optional)
 * @param {string} teamName - Team name (optional)
 */
export const notifyUserAdded = async (userId, clubId, clubName, teamId = null, teamName = null) => {
  try {
    const notifyUserAddedFn = httpsCallable(functions, 'notifyUserAdded');
    
    const result = await notifyUserAddedFn({
      userId,
      clubId,
      clubName,
      teamId,
      teamName
    });
    
    console.log('✅ User added notification sent');
    return result.data;
  } catch (error) {
    console.error('❌ Error sending user added notification:', error);
    // Don't throw - notification failures shouldn't block the user action
    return { success: false, error: error.message };
  }
};

/**
 * Notify user they were removed from a club or team
 * @param {string} userId - User ID
 * @param {string} clubId - Club ID
 * @param {string} clubName - Club name
 * @param {string} teamId - Team ID (optional)
 * @param {string} teamName - Team name (optional)
 */
export const notifyUserRemoved = async (userId, clubId, clubName, teamId = null, teamName = null) => {
  try {
    const notifyUserRemovedFn = httpsCallable(functions, 'notifyUserRemoved');
    
    const result = await notifyUserRemovedFn({
      userId,
      clubId,
      clubName,
      teamId,
      teamName
    });
    
    console.log('✅ User removed notification sent');
    return result.data;
  } catch (error) {
    console.error('❌ Error sending user removed notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify user their role was changed
 * @param {string} userId - User ID
 * @param {string} clubId - Club ID
 * @param {string} clubName - Club name
 * @param {string} newRole - New role
 * @param {string} oldRole - Old role
 */
export const notifyRoleChanged = async (userId, clubId, clubName, newRole, oldRole) => {
  try {
    const notifyRoleChangedFn = httpsCallable(functions, 'notifyRoleChanged');
    
    const result = await notifyRoleChangedFn({
      userId,
      clubId,
      clubName,
      newRole,
      oldRole
    });
    
    console.log('✅ Role changed notification sent');
    return result.data;
  } catch (error) {
    console.error('❌ Error sending role changed notification:', error);
    return { success: false, error: error.message };
  }
};





