// src/constants/roles.js
// Centralized role and permission constants for the Nexus application

/**
 * User Role Hierarchy (Highest to Lowest Authority)
 * 1. ADMIN (Super User)
 * 2. CLUB_OWNER (Resource Owner)
 * 3. TRAINER (Team Manager)
 * 4. ASSISTANT (Team Helper)
 * 5. USER (Regular Member)
 */

export const ROLES = {
  ADMIN: 'admin',
  CLUB_OWNER: 'clubOwner',
  TRAINER: 'trainer',
  ASSISTANT: 'assistant',
  USER: 'user',
  PARENT: 'parent', // Legacy support
};

export const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 5,
  [ROLES.CLUB_OWNER]: 4,
  [ROLES.TRAINER]: 3,
  [ROLES.ASSISTANT]: 2,
  [ROLES.USER]: 1,
  [ROLES.PARENT]: 1,
};

/**
 * Permission types for granular access control
 */
export const PERMISSIONS = {
  // Club Permissions
  CREATE_CLUB: 'create_club',
  MANAGE_CLUB: 'manage_club',
  DELETE_CLUB: 'delete_club',
  VIEW_CLUB: 'view_club',
  TRANSFER_CLUB_OWNERSHIP: 'transfer_club_ownership',
  MANAGE_CLUB_SETTINGS: 'manage_club_settings',
  
  // Team Permissions
  CREATE_TEAM: 'create_team',
  MANAGE_TEAM: 'manage_team',
  DELETE_TEAM: 'delete_team',
  VIEW_TEAM: 'view_team',
  ADD_TEAM_MEMBER: 'add_team_member',
  REMOVE_TEAM_MEMBER: 'remove_team_member',
  
  // Event Permissions
  CREATE_CLUB_EVENT: 'create_club_event',
  CREATE_TEAM_EVENT: 'create_team_event',
  CREATE_PERSONAL_EVENT: 'create_personal_event',
  MODIFY_EVENT: 'modify_event',
  DELETE_EVENT: 'delete_event',
  VIEW_EVENT: 'view_event',
  MANAGE_EVENT_ATTENDANCE: 'manage_event_attendance',
  
  // Chat Permissions
  CREATE_ONE_TO_ONE_CHAT: 'create_one_to_one_chat',
  CREATE_TEAM_CHAT: 'create_team_chat',
  CREATE_CLUB_CHAT: 'create_club_chat',
  VIEW_CHAT: 'view_chat',
  SEND_MESSAGE: 'send_message',
  
  // Role Management Permissions
  ASSIGN_CLUB_OWNER: 'assign_club_owner',
  ASSIGN_TRAINER: 'assign_trainer',
  ASSIGN_ASSISTANT: 'assign_assistant',
  PROMOTE_USER: 'promote_user',
  DEMOTE_USER: 'demote_user',
  CHANGE_USER_ROLE: 'change_user_role',
  
  // Member Management
  ADD_CLUB_MEMBER: 'add_club_member',
  REMOVE_CLUB_MEMBER: 'remove_club_member',
  ACCEPT_JOIN_REQUEST: 'accept_join_request',
  
  // Admin Permissions
  ACCESS_ADMIN_DASHBOARD: 'access_admin_dashboard',
  CREATE_VOUCHER: 'create_voucher',
  MANAGE_SUBSCRIPTIONS: 'manage_subscriptions',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_APP_SETTINGS: 'manage_app_settings',
  
  // Account Permissions
  DELETE_OWN_ACCOUNT: 'delete_own_account',
  DELETE_USER_ACCOUNT: 'delete_user_account',
  
  // Attendance & Orders
  CREATE_ATTENDANCE: 'create_attendance',
  MODIFY_ATTENDANCE: 'modify_attendance',
  VIEW_ATTENDANCE: 'view_attendance',
  CREATE_ORDER: 'create_order',
  MANAGE_ORDER: 'manage_order',
  VIEW_ORDER: 'view_order',
};

/**
 * Resource types for permission checks
 */
export const RESOURCE_TYPES = {
  CLUB: 'club',
  TEAM: 'team',
  EVENT: 'event',
  CHAT: 'chat',
  USER: 'user',
  ORDER: 'order',
  ATTENDANCE: 'attendance',
  SUBSCRIPTION: 'subscription',
};

/**
 * Event types
 */
export const EVENT_TYPES = {
  CLUB: 'club',
  TEAM: 'team',
  PERSONAL: 'personal',
};

/**
 * Subscription statuses
 */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  TRIAL: 'trial',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
};

/**
 * Subscription plans
 */
export const SUBSCRIPTION_PLANS = {
  TRIAL: 'trial',
  USER: 'user',
  CLUB: 'club',
  FULL: 'full',
};

/**
 * Error messages for permission denials
 */
export const PERMISSION_ERRORS = {
  // Club Errors
  NOT_CLUB_OWNER: 'You need to be a Club Owner to perform this action',
  SUBSCRIPTION_EXPIRED: 'Your club subscription has expired. Please renew to continue',
  NOT_CLUB_MEMBER: 'You must be a member of this club to view it',
  CANNOT_DELETE_CLUB: 'Only the club owner can delete this club',
  CANNOT_TRANSFER_OWNERSHIP: 'Only the club owner can transfer ownership',
  
  // Team Errors
  NOT_TRAINER: 'Only trainers can create team events',
  NOT_TEAM_MEMBER: 'You must be a member of this team to view it',
  CANNOT_REMOVE_LAST_TRAINER: 'Cannot remove the last trainer from a team',
  INSUFFICIENT_TEAM_PERMISSIONS: 'You do not have permission to manage this team',
  
  // Event Errors
  CANNOT_CREATE_CLUB_EVENT: 'Only club owners can create club-wide events',
  CANNOT_CREATE_TEAM_EVENT: 'You do not have permission to create team events',
  CANNOT_MODIFY_EVENT: 'You do not have permission to modify this event',
  CANNOT_DELETE_EVENT: 'You do not have permission to delete this event',
  
  // Chat Errors
  CANNOT_CREATE_TEAM_CHAT: 'You do not have permission to create team chats',
  CANNOT_CREATE_CLUB_CHAT: 'Only club owners can create club-wide chats',
  NOT_CHAT_PARTICIPANT: 'You are not a participant in this chat',
  
  // Role Management Errors
  CANNOT_PROMOTE: 'You do not have permission to promote users',
  CANNOT_DEMOTE: 'You do not have permission to demote users',
  CANNOT_SELF_PROMOTE: 'Users cannot promote themselves',
  CANNOT_DEMOTE_ADMIN: 'Admins cannot be demoted',
  
  // General Errors
  UNAUTHORIZED: 'You are not authorized to perform this action',
  NOT_AUTHENTICATED: 'You must be logged in to perform this action',
  RESOURCE_NOT_FOUND: 'The requested resource was not found',
  SUBSCRIPTION_REQUIRED: 'An active subscription is required for this action',
  INSUFFICIENT_PERMISSIONS: 'You do not have sufficient permissions',
};

/**
 * Action types for audit logging
 */
export const AUDIT_ACTIONS = {
  // Club Actions
  CLUB_CREATED: 'club_created',
  CLUB_MODIFIED: 'club_modified',
  CLUB_DELETED: 'club_deleted',
  CLUB_OWNERSHIP_TRANSFERRED: 'club_ownership_transferred',
  
  // Team Actions
  TEAM_CREATED: 'team_created',
  TEAM_MODIFIED: 'team_modified',
  TEAM_DELETED: 'team_deleted',
  
  // Role Changes
  ROLE_PROMOTED: 'role_promoted',
  ROLE_DEMOTED: 'role_demoted',
  TRAINER_ASSIGNED: 'trainer_assigned',
  TRAINER_REMOVED: 'trainer_removed',
  ASSISTANT_ASSIGNED: 'assistant_assigned',
  ASSISTANT_REMOVED: 'assistant_removed',
  
  // Member Actions
  MEMBER_ADDED: 'member_added',
  MEMBER_REMOVED: 'member_removed',
  JOIN_REQUEST_ACCEPTED: 'join_request_accepted',
  JOIN_REQUEST_REJECTED: 'join_request_rejected',
  
  // Event Actions
  EVENT_CREATED: 'event_created',
  EVENT_MODIFIED: 'event_modified',
  EVENT_DELETED: 'event_deleted',
  
  // Permission Actions
  PERMISSION_GRANTED: 'permission_granted',
  PERMISSION_REVOKED: 'permission_revoked',
  TEMPORARY_ACCESS_GRANTED: 'temporary_access_granted',
  
  // Subscription Actions
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
};

/**
 * Helper function to check if a role has higher or equal authority than another
 */
export const hasHigherOrEqualRole = (userRole, requiredRole) => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

/**
 * Helper function to get role display name
 */
export const getRoleDisplayName = (role) => {
  switch (role) {
    case ROLES.ADMIN:
      return 'Admin';
    case ROLES.CLUB_OWNER:
      return 'Club Owner';
    case ROLES.TRAINER:
      return 'Trainer';
    case ROLES.ASSISTANT:
      return 'Assistant';
    case ROLES.USER:
      return 'User';
    case ROLES.PARENT:
      return 'Parent';
    default:
      return 'Unknown';
  }
};

export default {
  ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS,
  RESOURCE_TYPES,
  EVENT_TYPES,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLANS,
  PERMISSION_ERRORS,
  AUDIT_ACTIONS,
  hasHigherOrEqualRole,
  getRoleDisplayName,
};

