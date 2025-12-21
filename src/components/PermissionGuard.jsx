// src/components/PermissionGuard.jsx
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin, usePermission, useHasSubscription } from '../hooks/usePermissions';
import AccessDenied from './AccessDenied';
import SubscriptionRequired from './SubscriptionRequired';

/**
 * PermissionGuard - Conditionally render content based on permissions
 * 
 * @param {ReactNode} children - Content to render if permission is granted
 * @param {string} require - Permission requirement: 'auth', 'admin', 'subscription', 'permission'
 * @param {string} resourceType - Resource type for permission check (club, team, event, etc.)
 * @param {string} resourceId - Resource ID for permission check
 * @param {string} action - Action to check (from PERMISSIONS)
 * @param {ReactNode} fallback - Custom fallback component
 * @param {string} fallbackMessage - Custom message for AccessDenied
 * @param {boolean} hideOnDeny - If true, renders nothing instead of AccessDenied
 */
export default function PermissionGuard({ 
  children, 
  require = 'auth',
  resourceType,
  resourceId,
  action,
  fallback,
  fallbackMessage,
  hideOnDeny = false
}) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { hasSubscription } = useHasSubscription();
  
  // Auth check
  if (require === 'auth') {
    if (!user) {
      if (hideOnDeny) return null;
      return fallback || <AccessDenied message="You must be logged in to view this content." />;
    }
    return children;
  }

  // Admin check
  if (require === 'admin') {
    if (!isAdmin) {
      if (hideOnDeny) return null;
      return fallback || <AccessDenied message={fallbackMessage || "Only administrators can access this content."} title="Admin Access Required" icon="👑" />;
    }
    return children;
  }

  // Subscription check
  if (require === 'subscription') {
    if (!hasSubscription && !isAdmin) {
      if (hideOnDeny) return null;
      return fallback || <SubscriptionRequired />;
    }
    return children;
  }

  // Permission check (requires resourceType, resourceId, and action)
  if (require === 'permission') {
    return <PermissionCheck
      resourceType={resourceType}
      resourceId={resourceId}
      action={action}
      fallback={fallback}
      fallbackMessage={fallbackMessage}
      hideOnDeny={hideOnDeny}
    >
      {children}
    </PermissionCheck>;
  }

  // Default: render children
  return children;
}

// Internal component for permission checking with loading state
function PermissionCheck({ children, resourceType, resourceId, action, fallback, fallbackMessage, hideOnDeny }) {
  const { allowed, loading, reason } = usePermission(resourceType, resourceId, action);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!allowed) {
    if (hideOnDeny) return null;
    return fallback || <AccessDenied message={fallbackMessage || reason} />;
  }

  return children;
}

// Shorthand components for common use cases
export function RequireAuth({ children, fallback, hideOnDeny = false }) {
  return (
    <PermissionGuard require="auth" fallback={fallback} hideOnDeny={hideOnDeny}>
      {children}
    </PermissionGuard>
  );
}

export function RequireAdmin({ children, fallback, hideOnDeny = false }) {
  return (
    <PermissionGuard require="admin" fallback={fallback} hideOnDeny={hideOnDeny}>
      {children}
    </PermissionGuard>
  );
}

export function RequireSubscription({ children, fallback, hideOnDeny = false }) {
  return (
    <PermissionGuard require="subscription" fallback={fallback} hideOnDeny={hideOnDeny}>
      {children}
    </PermissionGuard>
  );
}

export function RequirePermission({ children, resourceType, resourceId, action, fallback, hideOnDeny = false }) {
  return (
    <PermissionGuard 
      require="permission" 
      resourceType={resourceType}
      resourceId={resourceId}
      action={action}
      fallback={fallback}
      hideOnDeny={hideOnDeny}
    >
      {children}
    </PermissionGuard>
  );
}

// Inline permission check (for UI elements like buttons)
export function ShowIf({ children, condition, or = false }) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  
  let show = false;

  // If condition is a function, call it
  if (typeof condition === 'function') {
    show = condition({ user, isAdmin });
  } 
  // If condition is a boolean
  else if (typeof condition === 'boolean') {
    show = condition;
  }
  // If condition is a string (role check)
  else if (typeof condition === 'string') {
    show = user?.role === condition || (condition === 'admin' && isAdmin);
  }

  // OR logic: show if ANY condition is true
  if (or && Array.isArray(condition)) {
    show = condition.some(cond => {
      if (typeof cond === 'function') return cond({ user, isAdmin });
      if (typeof cond === 'boolean') return cond;
      if (typeof cond === 'string') return user?.role === cond || (cond === 'admin' && isAdmin);
      return false;
    });
  }

  return show ? children : null;
}

// Hide component based on permission (opposite of ShowIf)
export function HideIf({ children, condition }) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  
  let hide = false;

  if (typeof condition === 'function') {
    hide = condition({ user, isAdmin });
  } else if (typeof condition === 'boolean') {
    hide = condition;
  } else if (typeof condition === 'string') {
    hide = user?.role === condition || (condition === 'admin' && isAdmin);
  }

  return hide ? null : children;
}

