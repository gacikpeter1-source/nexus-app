// src/hooks/usePermissions.jsx
// React hooks for permission checking in components

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  isAdmin,
  isClubOwner,
  isClubMember,
  isTeamMember,
  canUserAccessResource,
  hasActiveClubSubscription
} from '../firebase/privileges';
import { PERMISSIONS, PERMISSION_ERRORS } from '../constants/roles';

/**
 * Hook: Check if user has a specific permission
 * 
 * @param {string} resourceType - Type of resource (club, team, event, etc.)
 * @param {string} resourceId - ID of the resource
 * @param {string} action - Action to check (from PERMISSIONS)
 * @returns {object} { allowed, loading, error, reason }
 * 
 * @example
 * const { allowed, loading } = usePermission('club', clubId, PERMISSIONS.MANAGE_CLUB);
 * if (loading) return <Spinner />;
 * if (!allowed) return <AccessDenied />;
 * return <ClubSettings />;
 */
export const usePermission = (resourceType, resourceId, action) => {
  const { user } = useAuth();
  const [state, setState] = useState({
    allowed: false,
    loading: true,
    error: null,
    reason: null,
  });

  useEffect(() => {
    const checkPermission = async () => {
      if (!user) {
        setState({
          allowed: false,
          loading: false,
          error: PERMISSION_ERRORS.NOT_AUTHENTICATED,
          reason: PERMISSION_ERRORS.NOT_AUTHENTICATED,
        });
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true }));
        
        const result = await canUserAccessResource(user.id, resourceType, resourceId, action);
        
        setState({
          allowed: result.allowed,
          loading: false,
          error: result.allowed ? null : result.reason,
          reason: result.reason,
        });
      } catch (error) {
        console.error('Error checking permission:', error);
        setState({
          allowed: false,
          loading: false,
          error: error.message,
          reason: PERMISSION_ERRORS.UNAUTHORIZED,
        });
      }
    };

    checkPermission();
  }, [user, resourceType, resourceId, action]);

  return state;
};

/**
 * Hook: Check if user is admin
 * 
 * @returns {boolean} true if user is admin
 * 
 * @example
 * const isUserAdmin = useIsAdmin();
 * if (isUserAdmin) {
 *   return <AdminDashboard />;
 * }
 */
export const useIsAdmin = () => {
  const { user } = useAuth();
  return user ? isAdmin(user) : false;
};

/**
 * Hook: Check if user is club owner
 * 
 * @param {string} clubId - Club ID to check
 * @returns {boolean} true if user owns the club
 * 
 * @example
 * const isOwner = useIsClubOwner(clubId);
 * if (isOwner) {
 *   return <ClubManagementButton />;
 * }
 */
export const useIsClubOwner = (clubId) => {
  const { user } = useAuth();
  return user && clubId ? isClubOwner(user, clubId) : false;
};

/**
 * Hook: Check if user is club member
 * 
 * @param {string} clubId - Club ID to check
 * @returns {object} { isMember, loading }
 * 
 * @example
 * const { isMember, loading } = useIsClubMember(clubId);
 * if (loading) return <Spinner />;
 * if (!isMember) return <JoinClubButton />;
 */
export const useIsClubMember = (clubId) => {
  const { user } = useAuth();
  const [state, setState] = useState({ isMember: false, loading: true });

  useEffect(() => {
    const checkMembership = async () => {
      if (!user || !clubId) {
        setState({ isMember: false, loading: false });
        return;
      }

      try {
        const isMember = await isClubMember(user.id, clubId);
        setState({ isMember, loading: false });
      } catch (error) {
        console.error('Error checking club membership:', error);
        setState({ isMember: false, loading: false });
      }
    };

    checkMembership();
  }, [user, clubId]);

  return state;
};

/**
 * Hook: Check if user is team member
 * 
 * @param {string} clubId - Club ID
 * @param {string} teamId - Team ID to check
 * @returns {object} { isMember, loading }
 * 
 * @example
 * const { isMember, loading } = useIsTeamMember(clubId, teamId);
 */
export const useIsTeamMember = (clubId, teamId) => {
  const { user } = useAuth();
  const [state, setState] = useState({ isMember: false, loading: true });

  useEffect(() => {
    const checkMembership = async () => {
      if (!user || !clubId || !teamId) {
        setState({ isMember: false, loading: false });
        return;
      }

      try {
        const isMember = await isTeamMember(user.id, clubId, teamId);
        setState({ isMember, loading: false });
      } catch (error) {
        console.error('Error checking team membership:', error);
        setState({ isMember: false, loading: false });
      }
    };

    checkMembership();
  }, [user, clubId, teamId]);

  return state;
};

/**
 * Hook: Check if user has active subscription
 * 
 * @returns {object} { hasSubscription, loading }
 * 
 * @example
 * const { hasSubscription, loading } = useHasSubscription();
 * if (!hasSubscription) {
 *   return <SubscriptionPrompt />;
 * }
 */
export const useHasSubscription = () => {
  const { user } = useAuth();
  const [state, setState] = useState({ hasSubscription: false, loading: true });

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setState({ hasSubscription: false, loading: false });
        return;
      }

      try {
        const hasSubscription = await hasActiveClubSubscription(user.id);
        setState({ hasSubscription, loading: false });
      } catch (error) {
        console.error('Error checking subscription:', error);
        setState({ hasSubscription: false, loading: false });
      }
    };

    checkSubscription();
  }, [user]);

  return state;
};

/**
 * Hook: Get user's role in a specific club context
 * 
 * @param {string} clubId - Club ID
 * @returns {object} { role, loading }
 * 
 * @example
 * const { role, loading } = useClubRole(clubId);
 * console.log(role); // 'admin', 'clubOwner', 'trainer', 'assistant', 'user'
 */
export const useClubRole = (clubId) => {
  const { user } = useAuth();
  const [state, setState] = useState({ role: null, loading: true });

  useEffect(() => {
    const determineRole = async () => {
      if (!user || !clubId) {
        setState({ role: null, loading: false });
        return;
      }

      try {
        // Check in order of highest to lowest authority
        if (isAdmin(user)) {
          setState({ role: 'admin', loading: false });
          return;
        }

        if (isClubOwner(user, clubId)) {
          setState({ role: 'clubOwner', loading: false });
          return;
        }

        // Would need to fetch club data to check trainer/assistant
        // For now, return user's global role
        setState({ role: user.role || 'user', loading: false });
      } catch (error) {
        console.error('Error determining club role:', error);
        setState({ role: 'user', loading: false });
      }
    };

    determineRole();
  }, [user, clubId]);

  return state;
};

/**
 * Hook: Check multiple permissions at once
 * 
 * @param {Array} permissions - Array of permission objects: [{ resourceType, resourceId, action }]
 * @returns {object} { allAllowed, permissions: [], loading }
 * 
 * @example
 * const { allAllowed, permissions, loading } = useMultiplePermissions([
 *   { resourceType: 'club', resourceId: clubId, action: PERMISSIONS.VIEW_CLUB },
 *   { resourceType: 'club', resourceId: clubId, action: PERMISSIONS.MANAGE_CLUB }
 * ]);
 */
export const useMultiplePermissions = (permissionsToCheck) => {
  const { user } = useAuth();
  const [state, setState] = useState({
    allAllowed: false,
    permissions: [],
    loading: true,
  });

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user) {
        setState({
          allAllowed: false,
          permissions: permissionsToCheck.map(p => ({ ...p, allowed: false })),
          loading: false,
        });
        return;
      }

      try {
        const results = await Promise.all(
          permissionsToCheck.map(async (perm) => {
            const result = await canUserAccessResource(
              user.id,
              perm.resourceType,
              perm.resourceId,
              perm.action
            );
            return { ...perm, allowed: result.allowed, reason: result.reason };
          })
        );

        setState({
          allAllowed: results.every(r => r.allowed),
          permissions: results,
          loading: false,
        });
      } catch (error) {
        console.error('Error checking multiple permissions:', error);
        setState({
          allAllowed: false,
          permissions: permissionsToCheck.map(p => ({ ...p, allowed: false })),
          loading: false,
        });
      }
    };

    checkPermissions();
  }, [user, JSON.stringify(permissionsToCheck)]);

  return state;
};

/**
 * Hook: Can perform action (simple wrapper)
 * 
 * @param {string} action - Simple action name
 * @param {object} context - Context object (club, team, etc.)
 * @returns {boolean} true if user can perform action
 * 
 * @example
 * const canCreateClub = useCan('createClub');
 * const canManageClub = useCan('manageClub', { clubId });
 */
export const useCan = (action, context = {}) => {
  const { user } = useAuth();
  const [can, setCan] = useState(false);

  useEffect(() => {
    const checkCan = async () => {
      if (!user) {
        setCan(false);
        return;
      }

      try {
        // Simple checks
        switch (action) {
          case 'viewAdminDashboard':
            setCan(isAdmin(user));
            break;
          
          case 'createClub':
            const hasSubscription = await hasActiveClubSubscription(user.id);
            setCan(isAdmin(user) || hasSubscription);
            break;
          
          case 'manageClub':
            if (context.clubId) {
              const isOwner = isClubOwner(user, context.clubId);
              const hasSubscription = await hasActiveClubSubscription(user.id);
              setCan(isAdmin(user) || (isOwner && hasSubscription));
            } else {
              setCan(false);
            }
            break;
          
          case 'createPersonalEvent':
            setCan(true); // All authenticated users
            break;
          
          default:
            setCan(false);
        }
      } catch (error) {
        console.error('Error checking can:', error);
        setCan(false);
      }
    };

    checkCan();
  }, [user, action, JSON.stringify(context)]);

  return can;
};

/**
 * HOC: Require permission to render component
 * 
 * @param {Component} Component - React component to protect
 * @param {string} resourceType - Resource type
 * @param {string} action - Action to check
 * @param {Function} getResourceId - Function to extract resourceId from props
 * 
 * @example
 * const ProtectedClubSettings = withPermission(
 *   ClubSettings,
 *   'club',
 *   PERMISSIONS.MANAGE_CLUB,
 *   (props) => props.clubId
 * );
 */
export const withPermission = (Component, resourceType, action, getResourceId) => {
  return (props) => {
    const resourceId = getResourceId(props);
    const { allowed, loading, reason } = usePermission(resourceType, resourceId, action);

    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-600">Loading...</div>
        </div>
      );
    }

    if (!allowed) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-red-600 text-xl mb-2">Access Denied</div>
          <div className="text-gray-600">{reason || 'You do not have permission to view this page.'}</div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

export default {
  usePermission,
  useIsAdmin,
  useIsClubOwner,
  useIsClubMember,
  useIsTeamMember,
  useHasSubscription,
  useClubRole,
  useMultiplePermissions,
  useCan,
  withPermission,
};

