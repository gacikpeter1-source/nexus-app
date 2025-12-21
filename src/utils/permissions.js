// src/utils/permissions.js
// Centralized permission checks for the entire application
// Enhanced with comprehensive privilege and access control

import { ROLES, PERMISSIONS, PERMISSION_ERRORS } from '../constants/roles';
import { 
  isAdmin as checkIsAdmin, 
  isClubOwner as checkIsClubOwner,
  isClubMember as checkIsClubMember,
  isTeamMember as checkIsTeamMember,
  canUserAccessResource,
  hasActiveClubSubscription,
  logPermissionChange
} from '../firebase/privileges';

/**
 * Permission System Overview:
 * 
 * Roles (Highest to Lowest Authority):
 * 1. ADMIN - Can see and do everything (Super User)
 * 2. CLUB_OWNER - Full control of their club(s) (Resource Owner)
 * 3. TRAINER - Manage teams and events (Team Manager)
 * 4. ASSISTANT - Help with team management (Team Helper)
 * 5. USER - Regular member
 * 
 * IMPORTANT: 
 * - ClubOwner status is ACTIVE only after purchasing CLUB subscription
 * - At least 1 Trainer is REQUIRED per team
 * - Only 1 ClubOwner per club at a time
 * - Trainers can only see teams they created or are members of
 */

// ============================================================================
// BASIC ROLE CHECKS
// ============================================================================

export const isSuperAdmin = (user) => {
  return user?.isSuperAdmin === true || user?.role === ROLES.ADMIN || user?.role === 'admin';
};

export const isTrainer = (user) => {
  return user?.role === ROLES.TRAINER || user?.role === 'trainer';
};

export const isAssistant = (user) => {
  return user?.role === ROLES.ASSISTANT || user?.role === 'assistant';
};

export const isRegularUser = (user) => {
  return user?.role === ROLES.USER || user?.role === 'user' || user?.role === 'parent';
};

export const isClubOwnerRole = (user) => {
  return user?.role === ROLES.CLUB_OWNER || user?.role === 'clubOwner';
};

// ============================================================================
// CLUB PERMISSIONS
// ============================================================================

export const isClubOwner = (user, club) => {
  if (!user || !club) return false;
  return club.createdBy === user.id;
};

export const isClubTrainer = (user, club) => {
  if (!user || !club) return false;
  return club.trainers?.includes(user.id);
};

export const isClubAssistant = (user, club) => {
  if (!user || !club) return false;
  return club.assistants?.includes(user.id);
};

export const isClubMember = (user, club) => {
  if (!user || !club) return false;
  return club.members?.includes(user.id) ||
         club.trainers?.includes(user.id) ||
         club.assistants?.includes(user.id) ||
         club.createdBy === user.id;
};

export const canManageClub = async (user, club) => {
  if (!user || !club) return false;
  if (isSuperAdmin(user)) return true;
  
  // Check if user is club owner
  if (!isClubOwner(user, club)) return false;
  
  // Club owner must have active subscription
  const hasSubscription = await hasActiveClubSubscription(user.id);
  if (!hasSubscription) {
    console.warn('Club owner subscription expired:', user.id);
    return false;
  }
  
  return true;
};

export const canDeleteClub = async (user, club) => {
  // Only SuperAdmin or Club Owner can delete club
  if (isSuperAdmin(user)) return true;
  if (!isClubOwner(user, club)) return false;
  
  // Must have active subscription
  return await hasActiveClubSubscription(user.id);
};

export const canViewClub = (user, club) => {
  // SuperAdmin sees all, others see clubs they're member of
  return isSuperAdmin(user) || isClubMember(user, club);
};

// ============================================================================
// TEAM PERMISSIONS
// ============================================================================

export const isTeamTrainer = (user, team) => {
  if (!user || !team) return false;
  return team.trainers?.includes(user.id);
};

export const isTeamAssistant = (user, team) => {
  if (!user || !team) return false;
  return team.assistants?.includes(user.id);
};

export const isTeamMember = (user, team) => {
  if (!user || !team) return false;
  return team.members?.includes(user.id) ||
         team.trainers?.includes(user.id) ||
         team.assistants?.includes(user.id);
};

export const canManageTeam = (user, club, team) => {
  return isSuperAdmin(user) ||
         isClubOwner(user, club) ||
         isTeamTrainer(user, team) ||
         isTeamAssistant(user, team);
};

export const canCreateTeam = (user, club) => {
  return isSuperAdmin(user) ||
         isClubOwner(user, club) ||
         isClubTrainer(user, club);
};

export const canDeleteTeam = (user, club, team) => {
  return isSuperAdmin(user) ||
         isClubOwner(user, club) ||
         (isTeamTrainer(user, team) && isClubTrainer(user, club));
};

export const canViewTeam = (user, club, team) => {
  // SuperAdmin sees all, managers see all in their club, members see their teams
  return isSuperAdmin(user) ||
         isClubOwner(user, club) ||
         isClubTrainer(user, club) ||
         isClubAssistant(user, club) ||
         isTeamMember(user, team);
};

// ============================================================================
// USER MANAGEMENT PERMISSIONS
// ============================================================================

export const canPromoteToTrainer = (user, club) => {
  // Only SuperAdmin or Club Owner can promote to Trainer
  return isSuperAdmin(user) || isClubOwner(user, club);
};

export const canPromoteToAssistant = (user, club, team) => {
  // SuperAdmin, Club Owner, or Team Trainer can promote to Assistant
  return isSuperAdmin(user) ||
         isClubOwner(user, club) ||
         isTeamTrainer(user, team);
};

export const canDemoteUser = (user, club, targetUser) => {
  // Only SuperAdmin or Club Owner can demote users
  if (!targetUser) return false;
  
  // Can't demote yourself
  if (user?.id === targetUser.id) return false;
  
  // Can't demote SuperAdmin
  if (isSuperAdmin(targetUser)) return false;
  
  return isSuperAdmin(user) || isClubOwner(user, club);
};

export const canRemoveFromTeam = async (user, club, team, targetUserId) => {
  if (isSuperAdmin(user)) return true;
  
  if (!isClubOwner(user, club) && 
      !isTeamTrainer(user, team) && 
      !isTeamAssistant(user, team)) {
    return false;
  }
  
  // If removing a trainer, check if it's the last one
  if (team.trainers?.includes(targetUserId)) {
    if (team.trainers.length <= 1) {
      console.warn('Cannot remove last trainer from team:', team.id);
      return false; // Cannot remove last trainer
    }
  }
  
  return true;
};

export const canRemoveFromClub = (user, club) => {
  return isSuperAdmin(user) || isClubOwner(user, club);
};

export const canAcceptJoinRequest = (user, club, team = null) => {
  if (team) {
    // Team-specific request
    return isSuperAdmin(user) ||
           isClubOwner(user, club) ||
           isTeamTrainer(user, team) ||
           isTeamAssistant(user, team);
  } else {
    // Club-level request
    return isSuperAdmin(user) ||
           isClubOwner(user, club) ||
           isClubTrainer(user, club) ||
           isClubAssistant(user, club);
  }
};

// ============================================================================
// EVENT PERMISSIONS
// ============================================================================

export const canCreateClubEvent = (user, club) => {
  // Only SuperAdmin or Club Owner can create club-wide events
  return isSuperAdmin(user) || isClubOwner(user, club);
};

export const canCreateTeamEvent = (user, club, team) => {
  // SuperAdmin, Club Owner, Team Trainer, or Team Assistant
  return isSuperAdmin(user) ||
         isClubOwner(user, club) ||
         isTeamTrainer(user, team) ||
         isTeamAssistant(user, team);
};

export const canCreatePrivateEvent = (user) => {
  // All users can create private events
  return !!user;
};

export const canEditEvent = (user, event, club = null, team = null) => {
  if (!user || !event) return false;
  
  // Event creator can always edit
  if (event.createdBy === user.id) return true;
  
  // SuperAdmin can edit all
  if (isSuperAdmin(user)) return true;
  
  // Club-wide events: Club Owner can edit
  if (event.isClubEvent && club) {
    return isClubOwner(user, club);
  }
  
  // Team events: Team managers can edit
  if (event.teamId && club && team) {
    return isClubOwner(user, club) ||
           isTeamTrainer(user, team) ||
           isTeamAssistant(user, team);
  }
  
  return false;
};

export const canDeleteEvent = (user, event, club = null, team = null) => {
  // Same as edit permissions
  return canEditEvent(user, event, club, team);
};

export const canViewEvent = (user, event, clubs = [], teams = []) => {
  if (!user || !event) return false;
  
  // SuperAdmin sees all
  if (isSuperAdmin(user)) return true;
  
  // Event creator can view
  if (event.createdBy === user.id) return true;
  
  // Club-wide events: Must be member of club
  if (event.isClubEvent) {
    const club = clubs.find(c => c.id === event.clubId);
    return club && isClubMember(user, club);
  }
  
  // Team events: Must be member of team
  if (event.teamId) {
    const team = teams.find(t => t.id === event.teamId);
    return team && isTeamMember(user, team);
  }
  
  // Private events: Creator or invited user
  if (event.isPrivate) {
    return event.createdBy === user.id ||
           event.invitedUsers?.includes(user.id);
  }
  
  return false;
};

// ============================================================================
// ACCOUNT PERMISSIONS
// ============================================================================

export const canDeleteOwnAccount = (user) => {
  // All users can delete their own account
  return !!user;
};

export const canDeleteUserAccount = (user, targetUser) => {
  if (!user || !targetUser) return false;
  
  // Can't delete yourself (use canDeleteOwnAccount instead)
  if (user.id === targetUser.id) return false;
  
  // Can't delete SuperAdmin
  if (isSuperAdmin(targetUser)) return false;
  
  // Only SuperAdmin can delete other accounts
  return isSuperAdmin(user);
};

// ============================================================================
// VIEW PERMISSIONS (for filtering data)
// ============================================================================

export const getVisibleClubs = (user, allClubs) => {
  if (!user || !allClubs) return [];
  
  // SuperAdmin sees all clubs
  if (isSuperAdmin(user)) return allClubs;
  
  // Others see clubs they're member of
  return allClubs.filter(club => isClubMember(user, club));
};

export const getVisibleTeams = (user, club) => {
  if (!user || !club) return [];
  
  const clubTeams = club.teams || [];
  
  // SuperAdmin sees all teams
  if (isSuperAdmin(user)) return clubTeams;
  
  // Club Owner sees all teams in their club
  if (isClubOwner(user, club)) return clubTeams;
  
  // Club Trainers/Assistants see all teams
  if (isClubTrainer(user, club) || isClubAssistant(user, club)) {
    return clubTeams;
  }
  
  // Regular members see only teams they belong to
  return clubTeams.filter(team => isTeamMember(user, team));
};

export const getVisibleEvents = (user, allEvents, clubs = [], teams = []) => {
  if (!user || !allEvents) return [];
  
  // SuperAdmin sees all events
  if (isSuperAdmin(user)) return allEvents;
  
  // Filter events based on permissions
  return allEvents.filter(event => canViewEvent(user, event, clubs, teams));
};

// ============================================================================
// ROLE DISPLAY HELPERS
// ============================================================================

export const getRoleDisplay = (user, club = null) => {
  if (!user) return 'Guest';
  
  if (isSuperAdmin(user)) return 'SuperAdmin';
  
  if (club && isClubOwner(user, club)) return 'Club Owner';
  
  switch (user.role) {
    case 'trainer':
      return 'Trainer';
    case 'assistant':
      return 'Assistant';
    case 'parent':
      return 'Parent';
    case 'user':
    default:
      return 'Member';
  }
};

export const getRoleBadgeColor = (user, club = null) => {
  if (!user) return 'gray';
  
  if (isSuperAdmin(user)) return 'purple';
  if (club && isClubOwner(user, club)) return 'gold';
  
  switch (user.role) {
    case 'trainer':
      return 'blue';
    case 'assistant':
      return 'green';
    case 'parent':
      return 'orange';
    case 'user':
    default:
      return 'gray';
  }
};

// ============================================================================
// BULK PERMISSION CHECKS
// ============================================================================

export const getUserPermissions = (user, club = null, team = null) => {
  return {
    // Role
    isSuperAdmin: isSuperAdmin(user),
    isClubOwner: club ? isClubOwner(user, club) : false,
    isTrainer: isTrainer(user),
    isAssistant: isAssistant(user),
    
    // Club permissions
    canManageClub: club ? canManageClub(user, club) : false,
    canDeleteClub: club ? canDeleteClub(user, club) : false,
    canCreateTeam: club ? canCreateTeam(user, club) : false,
    
    // Team permissions
    canManageTeam: club && team ? canManageTeam(user, club, team) : false,
    canDeleteTeam: club && team ? canDeleteTeam(user, club, team) : false,
    
    // Event permissions
    canCreateClubEvent: club ? canCreateClubEvent(user, club) : false,
    canCreateTeamEvent: club && team ? canCreateTeamEvent(user, club, team) : false,
    canCreatePrivateEvent: canCreatePrivateEvent(user),
    
    // User management
    canPromoteToTrainer: club ? canPromoteToTrainer(user, club) : false,
    canPromoteToAssistant: club && team ? canPromoteToAssistant(user, club, team) : false,
    canAcceptJoinRequest: club ? canAcceptJoinRequest(user, club, team) : false
  };
};

export default {
  // Basic roles
  isSuperAdmin,
  isTrainer,
  isAssistant,
  isRegularUser,
  
  // Club
  isClubOwner,
  isClubTrainer,
  isClubAssistant,
  isClubMember,
  canManageClub,
  canDeleteClub,
  canViewClub,
  
  // Team
  isTeamTrainer,
  isTeamAssistant,
  isTeamMember,
  canManageTeam,
  canCreateTeam,
  canDeleteTeam,
  canViewTeam,
  
  // User management
  canPromoteToTrainer,
  canPromoteToAssistant,
  canDemoteUser,
  canRemoveFromTeam,
  canRemoveFromClub,
  canAcceptJoinRequest,
  
  // Events
  canCreateClubEvent,
  canCreateTeamEvent,
  canCreatePrivateEvent,
  canEditEvent,
  canDeleteEvent,
  canViewEvent,
  
  // Account
  canDeleteOwnAccount,
  canDeleteUserAccount,
  
  // View filtering
  getVisibleClubs,
  getVisibleTeams,
  getVisibleEvents,
  
  // Display helpers
  getRoleDisplay,
  getRoleBadgeColor,
  getUserPermissions
};
