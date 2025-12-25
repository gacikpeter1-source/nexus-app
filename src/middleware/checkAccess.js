// src/middleware/checkAccess.js
// Route protection middleware and access control helpers

import { ROLES, PERMISSIONS, PERMISSION_ERRORS } from '../constants/roles';
import { 
  isAdmin,
  isClubOwner,
  isClubMember,
  isTeamMember,
  canUserAccessResource,
  hasActiveClubSubscription
} from '../firebase/privileges';

/**
 * Middleware: Require authentication
 * Usage: Protect routes that require a logged-in user
 */
export const requireAuth = (user) => {
  if (!user) {
    return {
      allowed: false,
      error: PERMISSION_ERRORS.NOT_AUTHENTICATED,
      redirectTo: '/login'
    };
  }
  return { allowed: true };
};

/**
 * Middleware: Require admin role
 * Usage: Protect admin-only routes
 */
export const requireAdmin = (user) => {
  const authCheck = requireAuth(user);
  if (!authCheck.allowed) return authCheck;
  
  if (!isAdmin(user)) {
    return {
      allowed: false,
      error: PERMISSION_ERRORS.INSUFFICIENT_PERMISSIONS,
      redirectTo: '/'
    };
  }
  
  return { allowed: true };
};

/**
 * Middleware: Require club ownership
 * Usage: Protect club management routes
 */
export const requireClubOwner = async (user, clubId) => {
  const authCheck = requireAuth(user);
  if (!authCheck.allowed) return authCheck;
  
  // Admins bypass this check
  if (isAdmin(user)) {
    return { allowed: true };
  }
  
  if (!isClubOwner(user, clubId)) {
    return {
      allowed: false,
      error: PERMISSION_ERRORS.NOT_CLUB_OWNER,
      redirectTo: '/'
    };
  }
  
  // Check if subscription is active
  const hasSubscription = await hasActiveClubSubscription(user.id);
  if (!hasSubscription) {
    return {
      allowed: false,
      error: PERMISSION_ERRORS.SUBSCRIPTION_EXPIRED,
      redirectTo: '/subscription'
    };
  }
  
  return { allowed: true };
};

/**
 * Middleware: Require club membership
 * Usage: Protect club content from non-members
 */
export const requireClubMembership = async (user, clubId) => {
  const authCheck = requireAuth(user);
  if (!authCheck.allowed) return authCheck;
  
  // Admins bypass this check
  if (isAdmin(user)) {
    return { allowed: true };
  }
  
  const isMember = await isClubMember(user.id, clubId);
  if (!isMember) {
    return {
      allowed: false,
      error: PERMISSION_ERRORS.NOT_CLUB_MEMBER,
      redirectTo: '/clubs'
    };
  }
  
  return { allowed: true };
};

/**
 * Middleware: Require team membership
 * Usage: Protect team content from non-members
 */
export const requireTeamMembership = async (user, clubId, teamId) => {
  const authCheck = requireAuth(user);
  if (!authCheck.allowed) return authCheck;
  
  // Admins bypass this check
  if (isAdmin(user)) {
    return { allowed: true };
  }
  
  const isMember = await isTeamMember(user.id, clubId, teamId);
  if (!isMember) {
    return {
      allowed: false,
      error: PERMISSION_ERRORS.NOT_TEAM_MEMBER,
      redirectTo: `/club/${clubId}`
    };
  }
  
  return { allowed: true };
};

/**
 * Middleware: Require active subscription
 * Usage: Protect features that require paid subscription
 */
export const requireSubscription = async (user, subscriptionType = 'club') => {
  const authCheck = requireAuth(user);
  if (!authCheck.allowed) return authCheck;
  
  // Admins bypass subscription checks
  if (isAdmin(user)) {
    return { allowed: true };
  }
  
  if (subscriptionType === 'club') {
    const hasSubscription = await hasActiveClubSubscription(user.id);
    if (!hasSubscription) {
      return {
        allowed: false,
        error: PERMISSION_ERRORS.SUBSCRIPTION_REQUIRED,
        redirectTo: '/subscription'
      };
    }
  }
  
  return { allowed: true };
};

/**
 * Middleware: Check resource permission
 * Usage: Generic permission checker for any resource type
 */
export const checkResourcePermission = async (user, resourceType, resourceId, action) => {
  const authCheck = requireAuth(user);
  if (!authCheck.allowed) return authCheck;
  
  const result = await canUserAccessResource(user.id, resourceType, resourceId, action);
  
  if (!result.allowed) {
    return {
      allowed: false,
      error: result.reason || PERMISSION_ERRORS.UNAUTHORIZED,
      redirectTo: '/'
    };
  }
  
  return { allowed: true };
};

/**
 * HOC: Protect component with permission check
 * Usage: Wrap React components to enforce permissions
 * 
 * Example:
 * const ProtectedComponent = withPermission(
 *   MyComponent,
 *   (user, props) => requireClubOwner(user, props.clubId)
 * );
 */
export const withPermission = (Component, permissionCheck) => {
  return (props) => {
    const { user, ...restProps } = props;
    
    const [isAuthorized, setIsAuthorized] = React.useState(null);
    const [error, setError] = React.useState(null);
    
    React.useEffect(() => {
      const checkPermission = async () => {
        const result = await permissionCheck(user, restProps);
        setIsAuthorized(result.allowed);
        if (!result.allowed) {
          setError(result.error);
        }
      };
      
      checkPermission();
    }, [user, restProps]);
    
    if (isAuthorized === null) {
      return <div>Loading...</div>;
    }
    
    if (!isAuthorized) {
      return (
        <div className="permission-denied">
          <h2>Access Denied</h2>
          <p>{error || 'You do not have permission to view this page.'}</p>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
};

/**
 * Helper: Get user's effective role in a specific context
 * Returns the highest role user has in given context
 */
export const getUserEffectiveRole = (user, club = null, team = null) => {
  if (!user) return null;
  
  // Admin is always highest
  if (isAdmin(user)) {
    return ROLES.ADMIN;
  }
  
  // Check club owner
  if (club && isClubOwner(user, club.id)) {
    return ROLES.CLUB_OWNER;
  }
  
  // Check trainer
  if (team && team.trainers?.includes(user.id)) {
    return ROLES.TRAINER;
  }
  if (club && club.trainers?.includes(user.id)) {
    return ROLES.TRAINER;
  }
  
  // Check assistant
  if (team && team.assistants?.includes(user.id)) {
    return ROLES.ASSISTANT;
  }
  if (club && club.assistants?.includes(user.id)) {
    return ROLES.ASSISTANT;
  }
  
  // Default to user role
  return user.role || ROLES.USER;
};

/**
 * Helper: Check if user can perform action (simple wrapper)
 */
export const can = async (user, action, resource) => {
  if (!user) return false;
  
  // Simple action checks
  switch (action) {
    case 'viewAdminDashboard':
      return isAdmin(user);
      
    case 'createClub':
      return isAdmin(user) || await hasActiveClubSubscription(user.id);
      
    case 'createPersonalEvent':
      return true; // All authenticated users
      
    default:
      // For resource-specific actions, use full permission check
      if (resource && resource.type && resource.id) {
        const result = await canUserAccessResource(user.id, resource.type, resource.id, action);
        return result.allowed;
      }
      return false;
  }
};

/**
 * Helper: Get permission error message
 */
export const getPermissionErrorMessage = (errorCode) => {
  return PERMISSION_ERRORS[errorCode] || PERMISSION_ERRORS.UNAUTHORIZED;
};

/**
 * Helper: Check multiple permissions at once
 */
export const checkMultiplePermissions = async (user, permissionChecks) => {
  const results = await Promise.all(
    permissionChecks.map(check => check(user))
  );
  
  return {
    allowed: results.every(r => r.allowed),
    errors: results.filter(r => !r.allowed).map(r => r.error)
  };
};

export default {
  // Middleware
  requireAuth,
  requireAdmin,
  requireClubOwner,
  requireClubMembership,
  requireTeamMembership,
  requireSubscription,
  checkResourcePermission,
  
  // HOC
  withPermission,
  
  // Helpers
  getUserEffectiveRole,
  can,
  getPermissionErrorMessage,
  checkMultiplePermissions,
};



