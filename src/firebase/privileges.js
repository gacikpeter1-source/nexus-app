// src/firebase/privileges.js
// Core privilege checking and access control functions

import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';
import { ROLES, PERMISSIONS, PERMISSION_ERRORS, AUDIT_ACTIONS, SUBSCRIPTION_STATUS } from '../constants/roles';

/* ===========================
   USER ROLE CHECKS
   =========================== */

/**
 * Check if user is an Admin (Super User)
 */
export const isAdmin = (user) => {
  if (!user) return false;
  return user.role === ROLES.ADMIN || user.isSuperAdmin === true;
};

/**
 * Check if user is a Club Owner (of a specific club)
 */
export const isClubOwner = (user, clubId) => {
  if (!user || !clubId) return false;
  if (isAdmin(user)) return true; // Admins have all club owner privileges
  
  // Check if user owns this club
  return user.ownedClubs?.includes(clubId);
};

/**
 * Check if user is a Trainer (in a specific club)
 */
export const isTrainerInClub = (user, clubId) => {
  if (!user || !clubId) return false;
  if (isAdmin(user)) return true;
  
  return user.clubRoles?.[clubId] === ROLES.TRAINER;
};

/**
 * Check if user is an Assistant (in a specific club)
 */
export const isAssistantInClub = (user, clubId) => {
  if (!user || !clubId) return false;
  if (isAdmin(user)) return true;
  
  return user.clubRoles?.[clubId] === ROLES.ASSISTANT;
};

/**
 * Check if user is a member of a club
 */
export const isClubMember = async (userId, clubId) => {
  try {
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    if (!clubDoc.exists()) return false;
    
    const clubData = clubDoc.data();
    return (
      clubData.members?.includes(userId) ||
      clubData.trainers?.includes(userId) ||
      clubData.assistants?.includes(userId) ||
      clubData.ownerId === userId
    );
  } catch (error) {
    console.error('Error checking club membership:', error);
    return false;
  }
};

/**
 * Check if user is a member of a team
 */
export const isTeamMember = async (userId, clubId, teamId) => {
  try {
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    if (!clubDoc.exists()) return false;
    
    const clubData = clubDoc.data();
    const team = clubData.teams?.find(t => t.id === teamId);
    if (!team) return false;
    
    return (
      team.members?.includes(userId) ||
      team.trainers?.includes(userId) ||
      team.assistants?.includes(userId)
    );
  } catch (error) {
    console.error('Error checking team membership:', error);
    return false;
  }
};

/**
 * Check if user is a trainer for a specific team
 */
export const isTrainerForTeam = async (userId, clubId, teamId) => {
  try {
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    if (!clubDoc.exists()) return false;
    
    const clubData = clubDoc.data();
    const team = clubData.teams?.find(t => t.id === teamId);
    if (!team) return false;
    
    return team.trainers?.includes(userId) || false;
  } catch (error) {
    console.error('Error checking trainer status:', error);
    return false;
  }
};

/* ===========================
   SUBSCRIPTION CHECKS
   =========================== */

/**
 * Check if user has an active Club subscription
 */
export const hasActiveClubSubscription = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return false;
    
    const userData = userDoc.data();
    
    // Check subscription status
    if (userData.subscriptionStatus !== SUBSCRIPTION_STATUS.ACTIVE &&
        userData.subscriptionStatus !== SUBSCRIPTION_STATUS.TRIAL) {
      return false;
    }
    
    // Check if subscription is for club management
    if (userData.subscriptionPlan === 'club' || userData.subscriptionPlan === 'full') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
};

/**
 * Check if club has an active subscription
 */
export const hasActiveClubSubscriptionByClubId = async (clubId) => {
  try {
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    if (!clubDoc.exists()) return false;
    
    const clubData = clubDoc.data();
    const ownerId = clubData.ownerId;
    
    if (!ownerId) return false;
    
    return await hasActiveClubSubscription(ownerId);
  } catch (error) {
    console.error('Error checking club subscription:', error);
    return false;
  }
};

/* ===========================
   PERMISSION VALIDATORS
   =========================== */

/**
 * Check if user can perform an action on a resource
 */
export const canUserAccessResource = async (userId, resourceType, resourceId, action) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return { allowed: false, reason: PERMISSION_ERRORS.NOT_AUTHENTICATED };
    }
    
    const user = { id: userId, ...userDoc.data() };
    
    // Admins can do everything
    if (isAdmin(user)) {
      return { allowed: true };
    }
    
    // Check based on resource type
    switch (resourceType) {
      case 'club':
        return await validateClubAccess(user, resourceId, action);
      case 'team':
        return await validateTeamAccess(user, resourceId, action);
      case 'event':
        return await validateEventAccess(user, resourceId, action);
      case 'chat':
        return await validateChatAccess(user, resourceId, action);
      default:
        return { allowed: false, reason: PERMISSION_ERRORS.UNAUTHORIZED };
    }
  } catch (error) {
    console.error('Error checking resource access:', error);
    return { allowed: false, reason: PERMISSION_ERRORS.UNAUTHORIZED };
  }
};

/**
 * Validate club access
 */
const validateClubAccess = async (user, clubId, action) => {
  const clubDoc = await getDoc(doc(db, 'clubs', clubId));
  if (!clubDoc.exists()) {
    return { allowed: false, reason: PERMISSION_ERRORS.RESOURCE_NOT_FOUND };
  }
  
  const clubData = clubDoc.data();
  const isOwner = clubData.ownerId === user.id;
  const isMember = await isClubMember(user.id, clubId);
  
  switch (action) {
    case PERMISSIONS.VIEW_CLUB:
      return { allowed: isMember, reason: isMember ? null : PERMISSION_ERRORS.NOT_CLUB_MEMBER };
      
    case PERMISSIONS.MANAGE_CLUB:
    case PERMISSIONS.MANAGE_CLUB_SETTINGS:
      if (!isOwner) {
        return { allowed: false, reason: PERMISSION_ERRORS.NOT_CLUB_OWNER };
      }
      // Check subscription
      const hasSubscription = await hasActiveClubSubscription(user.id);
      if (!hasSubscription) {
        return { allowed: false, reason: PERMISSION_ERRORS.SUBSCRIPTION_EXPIRED };
      }
      return { allowed: true };
      
    case PERMISSIONS.DELETE_CLUB:
      return { allowed: isOwner, reason: isOwner ? null : PERMISSION_ERRORS.CANNOT_DELETE_CLUB };
      
    case PERMISSIONS.TRANSFER_CLUB_OWNERSHIP:
      return { allowed: isOwner, reason: isOwner ? null : PERMISSION_ERRORS.CANNOT_TRANSFER_OWNERSHIP };
      
    case PERMISSIONS.CREATE_TEAM:
      return { 
        allowed: isOwner || clubData.trainers?.includes(user.id),
        reason: !isOwner && !clubData.trainers?.includes(user.id) ? PERMISSION_ERRORS.INSUFFICIENT_PERMISSIONS : null
      };
      
    case PERMISSIONS.ADD_CLUB_MEMBER:
    case PERMISSIONS.REMOVE_CLUB_MEMBER:
      return { allowed: isOwner, reason: isOwner ? null : PERMISSION_ERRORS.NOT_CLUB_OWNER };
      
    default:
      return { allowed: false, reason: PERMISSION_ERRORS.UNAUTHORIZED };
  }
};

/**
 * Validate team access
 */
const validateTeamAccess = async (user, teamData, action) => {
  const { clubId, teamId } = teamData;
  
  const clubDoc = await getDoc(doc(db, 'clubs', clubId));
  if (!clubDoc.exists()) {
    return { allowed: false, reason: PERMISSION_ERRORS.RESOURCE_NOT_FOUND };
  }
  
  const clubData = clubDoc.data();
  const team = clubData.teams?.find(t => t.id === teamId);
  if (!team) {
    return { allowed: false, reason: PERMISSION_ERRORS.RESOURCE_NOT_FOUND };
  }
  
  const isOwner = clubData.ownerId === user.id;
  const isTrainer = team.trainers?.includes(user.id);
  const isAssistant = team.assistants?.includes(user.id);
  const isMember = team.members?.includes(user.id) || isTrainer || isAssistant;
  
  switch (action) {
    case PERMISSIONS.VIEW_TEAM:
      // Trainers can see teams they created or are members of
      if (clubData.trainers?.includes(user.id)) {
        return { allowed: isMember || team.createdBy === user.id };
      }
      return { allowed: isOwner || isMember, reason: !isOwner && !isMember ? PERMISSION_ERRORS.NOT_TEAM_MEMBER : null };
      
    case PERMISSIONS.MANAGE_TEAM:
      return { 
        allowed: isOwner || isTrainer || isAssistant,
        reason: !isOwner && !isTrainer && !isAssistant ? PERMISSION_ERRORS.INSUFFICIENT_TEAM_PERMISSIONS : null
      };
      
    case PERMISSIONS.DELETE_TEAM:
      return { 
        allowed: isOwner || (isTrainer && team.createdBy === user.id),
        reason: PERMISSION_ERRORS.INSUFFICIENT_TEAM_PERMISSIONS
      };
      
    case PERMISSIONS.ADD_TEAM_MEMBER:
    case PERMISSIONS.REMOVE_TEAM_MEMBER:
      return { allowed: isOwner || isTrainer || isAssistant };
      
    default:
      return { allowed: false, reason: PERMISSION_ERRORS.UNAUTHORIZED };
  }
};

/**
 * Validate event access
 */
const validateEventAccess = async (user, eventId, action) => {
  const eventDoc = await getDoc(doc(db, 'events', eventId));
  if (!eventDoc.exists()) {
    return { allowed: false, reason: PERMISSION_ERRORS.RESOURCE_NOT_FOUND };
  }
  
  const eventData = eventDoc.data();
  const isCreator = eventData.createdBy === user.id;
  
  switch (action) {
    case PERMISSIONS.VIEW_EVENT:
      // Check based on event type
      if (eventData.type === 'personal') {
        return { allowed: isCreator || eventData.attendees?.includes(user.id) };
      }
      if (eventData.type === 'club') {
        return { allowed: await isClubMember(user.id, eventData.clubId) };
      }
      if (eventData.type === 'team') {
        return { allowed: await isTeamMember(user.id, eventData.clubId, eventData.teamId) };
      }
      return { allowed: false };
      
    case PERMISSIONS.MODIFY_EVENT:
    case PERMISSIONS.DELETE_EVENT:
      if (isCreator) return { allowed: true };
      
      if (eventData.type === 'club') {
        const clubDoc = await getDoc(doc(db, 'clubs', eventData.clubId));
        if (clubDoc.exists()) {
          const clubData = clubDoc.data();
          return { allowed: clubData.ownerId === user.id };
        }
      }
      
      if (eventData.type === 'team') {
        const isTrainer = await isTrainerForTeam(user.id, eventData.clubId, eventData.teamId);
        return { allowed: isTrainer };
      }
      
      return { allowed: false, reason: PERMISSION_ERRORS.CANNOT_MODIFY_EVENT };
      
    default:
      return { allowed: false, reason: PERMISSION_ERRORS.UNAUTHORIZED };
  }
};

/**
 * Validate chat access
 */
const validateChatAccess = async (user, chatId, action) => {
  const chatDoc = await getDoc(doc(db, 'chats', chatId));
  if (!chatDoc.exists()) {
    return { allowed: false, reason: PERMISSION_ERRORS.RESOURCE_NOT_FOUND };
  }
  
  const chatData = chatDoc.data();
  const isParticipant = chatData.participants?.includes(user.id);
  
  switch (action) {
    case PERMISSIONS.VIEW_CHAT:
    case PERMISSIONS.SEND_MESSAGE:
      return { 
        allowed: isParticipant,
        reason: isParticipant ? null : PERMISSION_ERRORS.NOT_CHAT_PARTICIPANT
      };
      
    default:
      return { allowed: false, reason: PERMISSION_ERRORS.UNAUTHORIZED };
  }
};

/* ===========================
   ROLE MANAGEMENT
   =========================== */

/**
 * Check if user can assign roles to others
 */
export const canAssignRole = async (granterId, targetUserId, role, clubId) => {
  try {
    const granterDoc = await getDoc(doc(db, 'users', granterId));
    if (!granterDoc.exists()) return { allowed: false, reason: PERMISSION_ERRORS.NOT_AUTHENTICATED };
    
    const granter = { id: granterId, ...granterDoc.data() };
    
    // Users cannot promote themselves
    if (granterId === targetUserId) {
      return { allowed: false, reason: PERMISSION_ERRORS.CANNOT_SELF_PROMOTE };
    }
    
    // Only admins can assign admin role
    if (role === ROLES.ADMIN) {
      return { allowed: isAdmin(granter), reason: PERMISSION_ERRORS.CANNOT_PROMOTE };
    }
    
    // Club Owner role requires admin or current club owner
    if (role === ROLES.CLUB_OWNER) {
      if (isAdmin(granter)) return { allowed: true };
      
      const clubDoc = await getDoc(doc(db, 'clubs', clubId));
      if (clubDoc.exists()) {
        const clubData = clubDoc.data();
        if (clubData.ownerId === granterId) {
          return { allowed: true }; // Transfer ownership
        }
      }
      return { allowed: false, reason: PERMISSION_ERRORS.CANNOT_PROMOTE };
    }
    
    // Trainer and Assistant roles require admin or club owner
    if (role === ROLES.TRAINER || role === ROLES.ASSISTANT) {
      if (isAdmin(granter)) return { allowed: true };
      
      const clubDoc = await getDoc(doc(db, 'clubs', clubId));
      if (clubDoc.exists()) {
        const clubData = clubDoc.data();
        if (clubData.ownerId === granterId) {
          return { allowed: true };
        }
      }
      return { allowed: false, reason: PERMISSION_ERRORS.CANNOT_PROMOTE };
    }
    
    return { allowed: false, reason: PERMISSION_ERRORS.UNAUTHORIZED };
  } catch (error) {
    console.error('Error checking role assignment permission:', error);
    return { allowed: false, reason: PERMISSION_ERRORS.UNAUTHORIZED };
  }
};

/**
 * Check if team has minimum required trainers
 */
export const hasMinimumTrainers = async (clubId, teamId) => {
  try {
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    if (!clubDoc.exists()) return false;
    
    const clubData = clubDoc.data();
    const team = clubData.teams?.find(t => t.id === teamId);
    if (!team) return false;
    
    return (team.trainers?.length || 0) >= 1;
  } catch (error) {
    console.error('Error checking minimum trainers:', error);
    return false;
  }
};

/**
 * Prevent removing last trainer from team
 */
export const canRemoveTrainerFromTeam = async (clubId, teamId, trainerId) => {
  try {
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    if (!clubDoc.exists()) {
      return { allowed: false, reason: PERMISSION_ERRORS.RESOURCE_NOT_FOUND };
    }
    
    const clubData = clubDoc.data();
    const team = clubData.teams?.find(t => t.id === teamId);
    if (!team) {
      return { allowed: false, reason: PERMISSION_ERRORS.RESOURCE_NOT_FOUND };
    }
    
    const trainerCount = team.trainers?.length || 0;
    
    if (trainerCount <= 1 && team.trainers?.includes(trainerId)) {
      return { allowed: false, reason: PERMISSION_ERRORS.CANNOT_REMOVE_LAST_TRAINER };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Error checking trainer removal:', error);
    return { allowed: false, reason: PERMISSION_ERRORS.UNAUTHORIZED };
  }
};

/* ===========================
   AUDIT LOGGING
   =========================== */

/**
 * Log permission change for audit trail
 */
export const logPermissionChange = async (action, details) => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      action,
      ...details,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error logging permission change:', error);
    // Don't throw - audit logging failure shouldn't break operations
  }
};

/**
 * Get audit logs for a specific user or resource
 */
export const getAuditLogs = async (filters = {}) => {
  try {
    let q = collection(db, 'auditLogs');
    
    if (filters.userId) {
      q = query(q, where('userId', '==', filters.userId));
    }
    
    if (filters.resourceId) {
      q = query(q, where('resourceId', '==', filters.resourceId));
    }
    
    if (filters.action) {
      q = query(q, where('action', '==', filters.action));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};

/* ===========================
   EXPORTS
   =========================== */

export default {
  // Role checks
  isAdmin,
  isClubOwner,
  isTrainerInClub,
  isAssistantInClub,
  isClubMember,
  isTeamMember,
  isTrainerForTeam,
  
  // Subscription checks
  hasActiveClubSubscription,
  hasActiveClubSubscriptionByClubId,
  
  // Permission validation
  canUserAccessResource,
  canAssignRole,
  hasMinimumTrainers,
  canRemoveTrainerFromTeam,
  
  // Audit logging
  logPermissionChange,
  getAuditLogs,
};

