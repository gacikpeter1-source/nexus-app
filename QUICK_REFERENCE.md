# Privileges & Access Control - Quick Reference

A quick reference guide for developers working with the Nexus privileges system.

---

## Common Imports

```javascript
// Constants
import { ROLES, PERMISSIONS, PERMISSION_ERRORS, AUDIT_ACTIONS } from '../constants/roles';

// Privilege Checks (Firebase)
import { 
  isAdmin, 
  isClubOwner, 
  canUserAccessResource,
  hasActiveClubSubscription 
} from '../firebase/privileges';

// Utilities
import { 
  isSuperAdmin, 
  canManageClub, 
  canDeleteEvent 
} from '../utils/permissions';

// Middleware
import { 
  requireAuth, 
  requireAdmin, 
  requireClubOwner 
} from '../middleware/checkAccess';

// Hooks
import { 
  usePermission, 
  useIsAdmin, 
  useIsClubOwner,
  useHasSubscription 
} from '../hooks/usePermissions';

// Audit Logging
import { 
  logRoleChange, 
  logClubAction, 
  getAuditLogs 
} from '../utils/auditLogger';
```

---

## Role Checks

### Check if user is admin
```javascript
// Synchronous (hook)
const isAdmin = useIsAdmin();

// Synchronous (function)
if (isAdmin(user)) { ... }
```

### Check if user is club owner
```javascript
// Synchronous (hook)
const isOwner = useIsClubOwner(clubId);

// Synchronous (function)
if (isClubOwner(user, clubId)) { ... }
```

### Check if user is club member
```javascript
// Async (hook)
const { isMember, loading } = useIsClubMember(clubId);

// Async (function)
const isMember = await isClubMember(userId, clubId);
```

---

## Permission Checks

### Check specific permission (React)
```javascript
import { usePermission } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';

const { allowed, loading, reason } = usePermission(
  'club',           // resource type
  clubId,           // resource ID
  PERMISSIONS.MANAGE_CLUB  // action
);

if (loading) return <Spinner />;
if (!allowed) return <AccessDenied message={reason} />;
return <ClubSettings />;
```

### Check permission (non-React)
```javascript
import { canUserAccessResource } from '../firebase/privileges';
import { PERMISSIONS } from '../constants/roles';

const result = await canUserAccessResource(
  userId,
  'club',
  clubId,
  PERMISSIONS.MANAGE_CLUB
);

if (!result.allowed) {
  console.error(result.reason);
  return;
}
```

---

## Route Protection

### Protect route with middleware
```javascript
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { requireClubOwner } from '../middleware/checkAccess';

const ClubSettingsPage = ({ clubId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAccess = async () => {
      const result = await requireClubOwner(user, clubId);
      if (!result.allowed) {
        toast.error(result.error);
        navigate(result.redirectTo);
      }
    };
    checkAccess();
  }, [user, clubId]);

  return <div>Settings...</div>;
};
```

### Protect component with HOC
```javascript
import { withPermission } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';

const ClubSettings = ({ clubId }) => {
  return <div>Settings...</div>;
};

export default withPermission(
  ClubSettings,
  'club',
  PERMISSIONS.MANAGE_CLUB,
  (props) => props.clubId
);
```

---

## Subscription Checks

### Check if user has subscription (React)
```javascript
const { hasSubscription, loading } = useHasSubscription();

if (loading) return <Spinner />;
if (!hasSubscription) {
  return <SubscriptionRequired />;
}
```

### Check subscription (non-React)
```javascript
const hasSubscription = await hasActiveClubSubscription(userId);
if (!hasSubscription) {
  toast.error('Subscription required');
  navigate('/subscription');
}
```

---

## Conditional UI Rendering

### Show/hide based on role
```javascript
const isAdmin = useIsAdmin();
const isOwner = useIsClubOwner(clubId);

return (
  <div>
    {(isAdmin || isOwner) && (
      <button>Manage Club</button>
    )}
  </div>
);
```

### Show/hide based on permission
```javascript
const { allowed } = usePermission('club', clubId, PERMISSIONS.MANAGE_CLUB);

return (
  <div>
    {allowed && <button>Edit Club</button>}
  </div>
);
```

### Show/hide based on multiple permissions
```javascript
const { allAllowed, permissions, loading } = useMultiplePermissions([
  { resourceType: 'club', resourceId: clubId, action: PERMISSIONS.VIEW_CLUB },
  { resourceType: 'club', resourceId: clubId, action: PERMISSIONS.MANAGE_CLUB }
]);

if (loading) return <Spinner />;

return (
  <div>
    {permissions[0].allowed && <ClubView />}
    {permissions[1].allowed && <ClubEdit />}
  </div>
);
```

---

## Audit Logging

### Log role change
```javascript
import { logRoleChange } from '../utils/auditLogger';
import { AUDIT_ACTIONS, ROLES } from '../constants/roles';

await logRoleChange(
  AUDIT_ACTIONS.TRAINER_ASSIGNED,
  adminId,        // Who made the change
  userId,         // Who was affected
  ROLES.USER,     // Old role
  ROLES.TRAINER,  // New role
  clubId          // Club context
);
```

### Log club action
```javascript
import { logClubAction } from '../utils/auditLogger';
import { AUDIT_ACTIONS } from '../constants/roles';

await logClubAction(
  AUDIT_ACTIONS.CLUB_MODIFIED,
  userId,
  clubId,
  { changes: { name: newName } }
);
```

### Log ownership transfer
```javascript
import { logOwnershipTransfer } from '../utils/auditLogger';

await logOwnershipTransfer(
  clubId,
  oldOwnerId,
  newOwnerId,
  transferredBy,
  'Club owner retired'  // reason (optional)
);
```

### Get audit logs
```javascript
import { getAuditLogs, formatAuditLog } from '../utils/auditLogger';

// Get logs for a specific club
const logs = await getAuditLogs({ clubId: 'club123', limit: 50 });

// Format for display
const formattedLogs = logs.map(formatAuditLog);
formattedLogs.forEach(log => {
  console.log(`${log.timeStr}: ${log.message}`);
});
```

---

## Error Handling

### Display permission errors
```javascript
import { PERMISSION_ERRORS } from '../constants/roles';

const result = await canUserAccessResource(...);
if (!result.allowed) {
  toast.error(result.reason || PERMISSION_ERRORS.UNAUTHORIZED);
}
```

### Custom error messages
```javascript
const { allowed, reason } = usePermission(...);

if (!allowed) {
  return (
    <div className="error">
      <h2>Access Denied</h2>
      <p>{reason}</p>
    </div>
  );
}
```

---

## Common Patterns

### Pattern 1: Check permission before action
```javascript
const handleDelete = async () => {
  const result = await canUserAccessResource(
    user.id, 'club', clubId, PERMISSIONS.DELETE_CLUB
  );
  
  if (!result.allowed) {
    toast.error(result.reason);
    return;
  }
  
  // Proceed with deletion
  await deleteClub(clubId);
  
  // Log the action
  await logClubAction(AUDIT_ACTIONS.CLUB_DELETED, user.id, clubId);
  
  toast.success('Club deleted');
  navigate('/clubs');
};
```

### Pattern 2: Role-based navigation menu
```javascript
const NavigationMenu = () => {
  const isAdmin = useIsAdmin();
  const { hasSubscription } = useHasSubscription();

  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/clubs">Clubs</Link>
      
      {hasSubscription && (
        <Link to="/create-club">Create Club</Link>
      )}
      
      {isAdmin && (
        <Link to="/admin">Admin Dashboard</Link>
      )}
    </nav>
  );
};
```

### Pattern 3: Conditional button rendering
```javascript
const EventCard = ({ event }) => {
  const { allowed: canEdit } = usePermission('event', event.id, PERMISSIONS.MODIFY_EVENT);
  const { allowed: canDelete } = usePermission('event', event.id, PERMISSIONS.DELETE_EVENT);

  return (
    <div className="event-card">
      <h3>{event.title}</h3>
      
      <div className="actions">
        {canEdit && <button onClick={handleEdit}>Edit</button>}
        {canDelete && <button onClick={handleDelete}>Delete</button>}
      </div>
    </div>
  );
};
```

### Pattern 4: Prevent removing last trainer
```javascript
import { canRemoveTrainerFromTeam } from '../firebase/privileges';

const handleRemoveTrainer = async (trainerId) => {
  const result = await canRemoveTrainerFromTeam(clubId, teamId, trainerId);
  
  if (!result.allowed) {
    toast.error(result.reason);
    return;
  }
  
  // Proceed with removal
  await removeTrainerFromTeam(teamId, trainerId);
  toast.success('Trainer removed');
};
```

### Pattern 5: Subscription-aware feature
```javascript
const CreateClubButton = () => {
  const { hasSubscription, loading } = useHasSubscription();

  if (loading) return <Spinner />;

  if (!hasSubscription) {
    return (
      <button onClick={() => navigate('/subscription')}>
        🔒 Get Subscription to Create Club
      </button>
    );
  }

  return (
    <button onClick={() => navigate('/create-club')}>
      + Create Club
    </button>
  );
};
```

---

## Role Constants

```javascript
ROLES.ADMIN        // 'admin'
ROLES.CLUB_OWNER   // 'clubOwner'
ROLES.TRAINER      // 'trainer'
ROLES.ASSISTANT    // 'assistant'
ROLES.USER         // 'user'
```

---

## Common Permissions

```javascript
// Club
PERMISSIONS.CREATE_CLUB
PERMISSIONS.MANAGE_CLUB
PERMISSIONS.DELETE_CLUB
PERMISSIONS.VIEW_CLUB

// Team
PERMISSIONS.CREATE_TEAM
PERMISSIONS.MANAGE_TEAM
PERMISSIONS.DELETE_TEAM
PERMISSIONS.VIEW_TEAM

// Event
PERMISSIONS.CREATE_CLUB_EVENT
PERMISSIONS.CREATE_TEAM_EVENT
PERMISSIONS.CREATE_PERSONAL_EVENT
PERMISSIONS.MODIFY_EVENT
PERMISSIONS.DELETE_EVENT
PERMISSIONS.VIEW_EVENT

// Chat
PERMISSIONS.CREATE_ONE_TO_ONE_CHAT
PERMISSIONS.CREATE_TEAM_CHAT
PERMISSIONS.CREATE_CLUB_CHAT
PERMISSIONS.VIEW_CHAT
PERMISSIONS.SEND_MESSAGE

// Role Management
PERMISSIONS.ASSIGN_TRAINER
PERMISSIONS.ASSIGN_ASSISTANT
PERMISSIONS.PROMOTE_USER
PERMISSIONS.DEMOTE_USER
```

---

## Common Audit Actions

```javascript
AUDIT_ACTIONS.CLUB_CREATED
AUDIT_ACTIONS.CLUB_MODIFIED
AUDIT_ACTIONS.CLUB_DELETED
AUDIT_ACTIONS.CLUB_OWNERSHIP_TRANSFERRED

AUDIT_ACTIONS.TEAM_CREATED
AUDIT_ACTIONS.TEAM_MODIFIED
AUDIT_ACTIONS.TEAM_DELETED

AUDIT_ACTIONS.ROLE_PROMOTED
AUDIT_ACTIONS.ROLE_DEMOTED
AUDIT_ACTIONS.TRAINER_ASSIGNED
AUDIT_ACTIONS.TRAINER_REMOVED

AUDIT_ACTIONS.EVENT_CREATED
AUDIT_ACTIONS.EVENT_MODIFIED
AUDIT_ACTIONS.EVENT_DELETED
```

---

## Troubleshooting

### Permission check always fails
- ✅ Verify user is authenticated
- ✅ Check user object has correct role
- ✅ Verify resource ID is correct
- ✅ Check Firestore document exists

### Subscription check fails
- ✅ Check user document has `subscriptionStatus` field
- ✅ Verify status is 'active' or 'trial'
- ✅ Check subscription hasn't expired

### Audit logs not saving
- ✅ Verify Firestore rules allow write to `auditLogs`
- ✅ Check Firebase config is correct
- ✅ Verify user is authenticated

### Hook returns stale data
- ✅ Check useEffect dependencies
- ✅ Verify state is being updated correctly
- ✅ Consider adding key to component

---

## Performance Tips

1. **Cache permission results** for frequently checked permissions
2. **Use hooks** instead of repeated function calls
3. **Batch permission checks** with `useMultiplePermissions`
4. **Memoize** permission components
5. **Lazy load** audit logs (pagination)

---

## Security Reminders

⚠️ **Always check permissions on both client and server**
⚠️ **Never trust client-side checks alone**
⚠️ **Log all permission changes**
⚠️ **Validate subscriptions server-side**
⚠️ **Protect sensitive data with Firestore rules**

---

For detailed documentation, see:
- [PRIVILEGES_DOCUMENTATION.md](./PRIVILEGES_DOCUMENTATION.md)
- [INTEGRATION_EXAMPLES.md](./INTEGRATION_EXAMPLES.md)
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)





