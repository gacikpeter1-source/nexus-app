// src/utils/auditLogger.js
// Audit logging system for permission changes and important actions

import { collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AUDIT_ACTIONS } from '../constants/roles';

/**
 * Log an audit event
 * @param {string} action - Action type from AUDIT_ACTIONS
 * @param {string} performedBy - User ID who performed the action
 * @param {string} targetId - Target resource ID (optional)
 * @param {object} details - Details about the action
 * @returns {Promise<string>} - Document ID of the audit log
 */
export const logAuditAction = async (action, performedBy, targetId = null, details = {}) => {
  try {
    const auditLog = {
      action,
      userId: performedBy,
      resourceId: targetId,
      timestamp: serverTimestamp(),
      ...details,
      // Add client information for better tracking
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      ip: 'logged-by-client', // Server-side functions should add real IP
    };
    
    const docRef = await addDoc(collection(db, 'auditLogs'), auditLog);
    console.log('✅ Audit log created:', action, docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating audit log:', error);
    // Don't throw - audit logging failure shouldn't break operations
    return null;
  }
};

/**
 * Log an audit event (alternative signature)
 * @param {string} action - Action type from AUDIT_ACTIONS
 * @param {object} details - Details about the action
 * @returns {Promise<string>} - Document ID of the audit log
 */
export const logAudit = async (action, details) => {
  try {
    const auditLog = {
      action,
      timestamp: serverTimestamp(),
      ...details,
      // Add client information for better tracking
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      ip: 'logged-by-client', // Server-side functions should add real IP
    };
    
    const docRef = await addDoc(collection(db, 'auditLogs'), auditLog);
    console.log('✅ Audit log created:', action, docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating audit log:', error);
    // Don't throw - audit logging failure shouldn't break operations
    return null;
  }
};

/**
 * Log club-related actions
 */
export const logClubAction = async (action, userId, clubId, details = {}) => {
  return await logAudit(action, {
    userId,
    resourceType: 'club',
    resourceId: clubId,
    ...details,
  });
};

/**
 * Log team-related actions
 */
export const logTeamAction = async (action, userId, clubId, teamId, details = {}) => {
  return await logAudit(action, {
    userId,
    resourceType: 'team',
    resourceId: teamId,
    clubId,
    ...details,
  });
};

/**
 * Log role change actions
 */
export const logRoleChange = async (action, granterId, targetUserId, oldRole, newRole, clubId = null, details = {}) => {
  return await logAudit(action, {
    granterId, // Who made the change
    targetUserId, // Who was affected
    oldRole,
    newRole,
    clubId,
    resourceType: 'user',
    resourceId: targetUserId,
    ...details,
  });
};

/**
 * Log ownership transfer
 */
export const logOwnershipTransfer = async (clubId, oldOwnerId, newOwnerId, transferredBy, reason = null) => {
  return await logAudit(AUDIT_ACTIONS.CLUB_OWNERSHIP_TRANSFERRED, {
    resourceType: 'club',
    resourceId: clubId,
    oldOwnerId,
    newOwnerId,
    transferredBy, // Who initiated the transfer (usually oldOwnerId or admin)
    reason,
  });
};

/**
 * Log member addition/removal
 */
export const logMemberAction = async (action, clubId, userId, addedBy, teamId = null, details = {}) => {
  return await logAudit(action, {
    resourceType: teamId ? 'team' : 'club',
    resourceId: teamId || clubId,
    clubId,
    teamId,
    userId, // Member being added/removed
    addedBy, // Who performed the action
    ...details,
  });
};

/**
 * Log event-related actions
 */
export const logEventAction = async (action, userId, eventId, eventType, clubId = null, teamId = null, details = {}) => {
  return await logAudit(action, {
    userId,
    resourceType: 'event',
    resourceId: eventId,
    eventType, // 'club', 'team', or 'personal'
    clubId,
    teamId,
    ...details,
  });
};

/**
 * Log subscription actions
 */
export const logSubscriptionAction = async (action, userId, subscriptionId, planType, details = {}) => {
  return await logAudit(action, {
    userId,
    resourceType: 'subscription',
    resourceId: subscriptionId,
    planType,
    ...details,
  });
};

/**
 * Log permission grant/revoke
 */
export const logPermissionChange = async (action, granterId, targetUserId, permission, resourceType, resourceId, details = {}) => {
  return await logAudit(action, {
    granterId,
    targetUserId,
    permission,
    resourceType,
    resourceId,
    ...details,
  });
};

/**
 * Log temporary access grant
 */
export const logTemporaryAccess = async (granterId, targetUserId, resourceType, resourceId, expiresAt, details = {}) => {
  return await logAudit(AUDIT_ACTIONS.TEMPORARY_ACCESS_GRANTED, {
    granterId,
    targetUserId,
    resourceType,
    resourceId,
    expiresAt,
    ...details,
  });
};

/**
 * Get audit logs with filters
 */
export const getAuditLogs = async (filters = {}) => {
  try {
    let q = collection(db, 'auditLogs');
    const constraints = [];
    
    // Filter by user
    if (filters.userId) {
      constraints.push(where('userId', '==', filters.userId));
    }
    
    // Filter by target user (for role changes)
    if (filters.targetUserId) {
      constraints.push(where('targetUserId', '==', filters.targetUserId));
    }
    
    // Filter by action
    if (filters.action) {
      constraints.push(where('action', '==', filters.action));
    }
    
    // Filter by resource type
    if (filters.resourceType) {
      constraints.push(where('resourceType', '==', filters.resourceType));
    }
    
    // Filter by resource ID
    if (filters.resourceId) {
      constraints.push(where('resourceId', '==', filters.resourceId));
    }
    
    // Filter by club
    if (filters.clubId) {
      constraints.push(where('clubId', '==', filters.clubId));
    }
    
    // Order by timestamp (most recent first)
    constraints.push(orderBy('timestamp', 'desc'));
    
    // Limit results
    if (filters.limit) {
      constraints.push(limit(filters.limit));
    }
    
    q = query(q, ...constraints);
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp,
    }));
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};

/**
 * Get audit logs for a specific club
 */
export const getClubAuditLogs = async (clubId, limitCount = 50) => {
  return await getAuditLogs({
    clubId,
    limit: limitCount,
  });
};

/**
 * Get audit logs for a specific user
 */
export const getUserAuditLogs = async (userId, limitCount = 50) => {
  return await getAuditLogs({
    userId,
    limit: limitCount,
  });
};

/**
 * Get role change audit logs
 */
export const getRoleChangeAuditLogs = async (targetUserId = null, limitCount = 50) => {
  const filters = {
    limit: limitCount,
  };
  
  if (targetUserId) {
    filters.targetUserId = targetUserId;
  }
  
  // Get all role-related actions
  const allLogs = await getAuditLogs(filters);
  
  return allLogs.filter(log => 
    log.action === AUDIT_ACTIONS.ROLE_PROMOTED ||
    log.action === AUDIT_ACTIONS.ROLE_DEMOTED ||
    log.action === AUDIT_ACTIONS.TRAINER_ASSIGNED ||
    log.action === AUDIT_ACTIONS.TRAINER_REMOVED ||
    log.action === AUDIT_ACTIONS.ASSISTANT_ASSIGNED ||
    log.action === AUDIT_ACTIONS.ASSISTANT_REMOVED
  );
};

/**
 * Format audit log for display
 */
export const formatAuditLog = (log) => {
  const date = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
  const timeStr = date.toLocaleString();
  
  let message = '';
  
  switch (log.action) {
    case AUDIT_ACTIONS.CLUB_CREATED:
      message = `Club created`;
      break;
    case AUDIT_ACTIONS.CLUB_MODIFIED:
      message = `Club settings modified`;
      break;
    case AUDIT_ACTIONS.CLUB_DELETED:
      message = `Club deleted`;
      break;
    case AUDIT_ACTIONS.CLUB_OWNERSHIP_TRANSFERRED:
      message = `Club ownership transferred from ${log.oldOwnerId} to ${log.newOwnerId}`;
      break;
    case AUDIT_ACTIONS.TEAM_CREATED:
      message = `Team created`;
      break;
    case AUDIT_ACTIONS.TEAM_MODIFIED:
      message = `Team modified`;
      break;
    case AUDIT_ACTIONS.TEAM_DELETED:
      message = `Team deleted`;
      break;
    case AUDIT_ACTIONS.ROLE_PROMOTED:
      message = `User promoted from ${log.oldRole} to ${log.newRole}`;
      break;
    case AUDIT_ACTIONS.ROLE_DEMOTED:
      message = `User demoted from ${log.oldRole} to ${log.newRole}`;
      break;
    case AUDIT_ACTIONS.TRAINER_ASSIGNED:
      message = `Trainer role assigned`;
      break;
    case AUDIT_ACTIONS.TRAINER_REMOVED:
      message = `Trainer role removed`;
      break;
    case AUDIT_ACTIONS.ASSISTANT_ASSIGNED:
      message = `Assistant role assigned`;
      break;
    case AUDIT_ACTIONS.ASSISTANT_REMOVED:
      message = `Assistant role removed`;
      break;
    case AUDIT_ACTIONS.MEMBER_ADDED:
      message = `Member added`;
      break;
    case AUDIT_ACTIONS.MEMBER_REMOVED:
      message = `Member removed`;
      break;
    case AUDIT_ACTIONS.EVENT_CREATED:
      message = `Event created (${log.eventType})`;
      break;
    case AUDIT_ACTIONS.EVENT_MODIFIED:
      message = `Event modified`;
      break;
    case AUDIT_ACTIONS.EVENT_DELETED:
      message = `Event deleted`;
      break;
    case AUDIT_ACTIONS.PERMISSION_GRANTED:
      message = `Permission "${log.permission}" granted`;
      break;
    case AUDIT_ACTIONS.PERMISSION_REVOKED:
      message = `Permission "${log.permission}" revoked`;
      break;
    case AUDIT_ACTIONS.TEMPORARY_ACCESS_GRANTED:
      message = `Temporary access granted until ${log.expiresAt}`;
      break;
    case AUDIT_ACTIONS.SUBSCRIPTION_CREATED:
      message = `Subscription created (${log.planType})`;
      break;
    case AUDIT_ACTIONS.SUBSCRIPTION_RENEWED:
      message = `Subscription renewed (${log.planType})`;
      break;
    case AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED:
      message = `Subscription cancelled`;
      break;
    case AUDIT_ACTIONS.SUBSCRIPTION_EXPIRED:
      message = `Subscription expired`;
      break;
    default:
      message = log.action;
  }
  
  return {
    ...log,
    message,
    timeStr,
  };
};

/**
 * Export audit logs to CSV (for admin download)
 */
export const exportAuditLogsToCSV = (logs) => {
  const headers = ['Timestamp', 'Action', 'User ID', 'Resource Type', 'Resource ID', 'Details'];
  const rows = logs.map(log => [
    log.timeStr || log.timestamp,
    log.action,
    log.userId || log.granterId || 'system',
    log.resourceType || '',
    log.resourceId || '',
    JSON.stringify(log.details || {}),
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  return csvContent;
};

/**
 * Download audit logs as CSV file
 */
export const downloadAuditLogsCSV = async (filters = {}, filename = 'audit-logs.csv') => {
  try {
    const logs = await getAuditLogs(filters);
    const formattedLogs = logs.map(formatAuditLog);
    const csv = exportAuditLogsToCSV(formattedLogs);
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    console.log('✅ Audit logs downloaded');
  } catch (error) {
    console.error('❌ Error downloading audit logs:', error);
    throw error;
  }
};

export default {
  // Log functions
  logAudit,
  logAuditAction,
  logClubAction,
  logTeamAction,
  logRoleChange,
  logOwnershipTransfer,
  logMemberAction,
  logEventAction,
  logSubscriptionAction,
  logPermissionChange,
  logTemporaryAccess,
  
  // Query functions
  getAuditLogs,
  getClubAuditLogs,
  getUserAuditLogs,
  getRoleChangeAuditLogs,
  
  // Utility functions
  formatAuditLog,
  exportAuditLogsToCSV,
  downloadAuditLogsCSV,
};

