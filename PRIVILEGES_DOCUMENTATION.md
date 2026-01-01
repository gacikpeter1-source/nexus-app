# Nexus Privileges & Access Control System

## Overview

This document describes the comprehensive privilege and access control system implemented in the Nexus application. The system provides fine-grained permission management across clubs, teams, events, chats, and other resources.

## Table of Contents

1. [Role Hierarchy](#role-hierarchy)
2. [Permission System](#permission-system)
3. [Implementation Files](#implementation-files)
4. [Usage Examples](#usage-examples)
5. [Security Rules](#security-rules)
6. [Audit Logging](#audit-logging)
7. [Testing Guide](#testing-guide)

---

## Role Hierarchy

Roles are ordered from highest to lowest authority:

### 1. ADMIN (Super User)
**Level**: System-wide authority

**Capabilities**:
- ✅ Full access to ALL parts of application
- ✅ Add/modify/delete ANY Club, Team, Chat, Event (regardless of ownership)
- ✅ Assign/unassign users to any Club/Team
- ✅ Promote/demote users to any role (including ClubOwner, Trainer)
- ✅ Create chat with any Club/Team member or owner
- ✅ Create vouchers and promotional codes
- ✅ Change application theme/settings globally
- ✅ Access admin dashboard and analytics
- ✅ Manage subscriptions and payments
- ✅ View audit logs (all user activities)

**Restrictions**:
- ⚠️ Cannot be demoted by anyone except another Admin
- ⚠️ Actions are logged for accountability

### 2. CLUB OWNER (Resource Owner)
**Level**: Club-wide authority

**Capabilities**:
- ✅ Full control over OWNED club(s) - one user can own multiple clubs
- ✅ Only ONE ClubOwner per club (ownership can be transferred)
- ✅ Create/modify/delete Teams within owned club
- ✅ Assign/remove Trainers, Assistants, Users within club
- ✅ Create chat with ALL club members
- ✅ Create events for entire CLUB (all members notified)
- ✅ Manage club settings (name, logo, description, privacy)
- ✅ View all teams and members in owned club
- ✅ Grant/revoke Trainer/Assistant roles
- ✅ Remove members from club
- ✅ Transfer club ownership to another user

**Restrictions**:
- ❌ Cannot access clubs they don't own
- ❌ Cannot modify other clubs' settings
- ❌ Status becomes ACTIVE only after purchasing CLUB subscription
- ❌ If subscription expires, club becomes read-only until renewed

**Activation Trigger**: Purchase CLUB subscription

### 3. TRAINER (Team Manager)
**Level**: Team-wide authority (within assigned club)

**Capabilities**:
- ✅ Granted by ClubOwner (not self-assigned)
- ✅ Change roles within club: User ↔ Trainer ↔ Assistant
- ✅ Create chat with entire team OR select team members
- ✅ Create/modify/delete events for THEIR team(s)
- ✅ Manage team attendance and participation
- ✅ Delete teams they created
- ✅ View teams where they are creator OR member
- ✅ Manage team roster (add/remove members from team)
- ✅ Create team-specific announcements

**Restrictions**:
- ❌ At least 1 Trainer REQUIRED per team (cannot remove last trainer)
- ❌ Can only see teams they created or are member of
- ❌ Cannot modify club-wide settings
- ❌ Cannot access other clubs (unless also member there)
- ❌ Cannot promote users to ClubOwner
- ❌ Cannot delete club (only ClubOwner/Admin can)

### 4. ASSISTANT (Team Helper)
**Level**: Same as Trainer but for recognition purposes

**Capabilities**:
- ✅ Same technical permissions as Trainer
- ✅ Usually a team member helping with tasks (not professional trainer)
- ✅ Manage team orders, attendance, events
- ✅ Create/modify team-level content
- ✅ Assist Trainer with administrative tasks

**Purpose**: Recognition role for active team members who help manage

**Restrictions**: Same as Trainer

**Note**: Role distinction is for UI/organizational clarity, not technical limits

### 5. USER (Regular Member)
**Level**: Membership-based access only

**Capabilities**:
- ✅ View clubs based on membership
- ✅ View teams based on membership
- ✅ View and respond in chats based on membership
- ✅ View calendar and events based on membership
- ✅ Create PERSONAL events (private to them)
- ✅ Invite other users to personal events
- ✅ Create 1-on-1 chat with any user in application
- ✅ Update own profile and settings
- ✅ Join clubs (if open) or request membership

**Restrictions**:
- ❌ Cannot see clubs/teams they're not member of
- ❌ Cannot create club-wide or team-wide events
- ❌ Cannot modify club/team settings
- ❌ Cannot assign roles to others
- ❌ Can only create personal events (not club/team events)

**Special Case - User with NO memberships**:
- ✅ Can create 1-on-1 chat with any user in application
- ✅ Can create personal events and invite other users
- ✅ Can view public clubs (if any)
- ❌ Cannot access any club/team content

---

## Permission System

### Permission Validation Rules

#### CLUBS:
- **Create Club**: ADMIN or User with active CLUB subscription
- **Modify Club**: ADMIN or ClubOwner of that club (with active subscription)
- **Delete Club**: ADMIN or ClubOwner of that club
- **View Club**: ADMIN or Club member or ClubOwner
- **Join Club**: Any User (if club is open) or by invitation
- **Transfer Ownership**: Current ClubOwner or ADMIN

#### TEAMS:
- **Create Team**: ADMIN, ClubOwner (of parent club), or Trainer (in that club)
- **Modify Team**: ADMIN, ClubOwner, or Trainer of that team
- **Delete Team**: ADMIN, ClubOwner, or Trainer who created the team
- **View Team**: ADMIN, ClubOwner, Team member, or Trainer/Assistant in that club
- **Must have at least 1 Trainer per team** (enforce in code)

#### EVENTS:
- **Create Club Event**: ADMIN or ClubOwner of that club
- **Create Team Event**: ADMIN, ClubOwner, Trainer, or Assistant of that team
- **Create Personal Event**: Any User
- **Modify Event**: Creator or ADMIN or ClubOwner (if club event) or Trainer (if team event)
- **Delete Event**: Creator or ADMIN or ClubOwner (if club event) or Trainer (if team event)
- **View Event**: Event attendees or club/team members (based on event type)

#### CHATS:
- **Create 1-on-1 Chat**: Any User (with any other user)
- **Create Team Chat**: ADMIN, ClubOwner, Trainer, or Assistant
- **Create Club Chat**: ADMIN or ClubOwner
- **View Chat**: Chat participants only
- **Send Message**: Chat participants only

#### ROLES:
- **Promote to ADMIN**: Only existing ADMIN
- **Assign ClubOwner**: ADMIN or transfer from current ClubOwner
- **Assign Trainer/Assistant**: ADMIN or ClubOwner of that club
- **Demote from role**: ADMIN or ClubOwner (for club roles)
- **User cannot promote themselves**

---

## Implementation Files

### Constants
**File**: `src/constants/roles.js`

Defines all roles, permissions, error messages, and audit action types.

```javascript
import { ROLES, PERMISSIONS, PERMISSION_ERRORS } from '../constants/roles';
```

### Privilege Checking
**File**: `src/firebase/privileges.js`

Core privilege checking functions for Firebase integration.

```javascript
import { 
  isAdmin, 
  isClubOwner, 
  canUserAccessResource,
  hasActiveClubSubscription 
} from '../firebase/privileges';
```

**Key Functions**:
- `isAdmin(user)` - Check if user is admin
- `isClubOwner(user, clubId)` - Check if user owns club
- `isClubMember(userId, clubId)` - Check club membership
- `isTeamMember(userId, clubId, teamId)` - Check team membership
- `canUserAccessResource(userId, resourceType, resourceId, action)` - Validate access
- `hasActiveClubSubscription(userId)` - Check subscription status

### Permission Utilities
**File**: `src/utils/permissions.js`

High-level permission checking utilities for UI components.

```javascript
import { 
  isSuperAdmin, 
  canManageClub, 
  canDeleteEvent 
} from '../utils/permissions';
```

### Middleware
**File**: `src/middleware/checkAccess.js`

Route protection middleware for React Router.

```javascript
import { 
  requireAuth, 
  requireAdmin, 
  requireClubOwner,
  requireClubMembership 
} from '../middleware/checkAccess';
```

**Usage Example**:
```javascript
// In a React component
useEffect(() => {
  const checkAccess = async () => {
    const result = await requireClubOwner(user, clubId);
    if (!result.allowed) {
      navigate(result.redirectTo);
      toast.error(result.error);
    }
  };
  checkAccess();
}, [user, clubId]);
```

### Audit Logging
**File**: `src/utils/auditLogger.js`

Comprehensive audit logging for all permission changes.

```javascript
import { 
  logRoleChange, 
  logClubAction, 
  getAuditLogs 
} from '../utils/auditLogger';
```

---

## Usage Examples

### Example 1: Check if user can manage club

```javascript
import { canManageClub } from '../utils/permissions';
import { hasActiveClubSubscription } from '../firebase/privileges';

const ClubSettings = ({ club, user }) => {
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      const allowed = await canManageClub(user, club);
      setCanManage(allowed);
    };
    checkPermission();
  }, [user, club]);

  if (!canManage) {
    return <div>You don't have permission to manage this club.</div>;
  }

  return <div>Club settings...</div>;
};
```

### Example 2: Protect route with middleware

```javascript
import { requireClubOwner } from '../middleware/checkAccess';
import { useAuth } from '../contexts/AuthContext';

const ClubManagementPage = ({ clubId }) => {
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

  return <div>Club management interface...</div>;
};
```

### Example 3: Log role change

```javascript
import { logRoleChange } from '../utils/auditLogger';
import { AUDIT_ACTIONS, ROLES } from '../constants/roles';

const promoteToTrainer = async (adminId, userId, clubId) => {
  // ... perform the role change in Firestore ...
  
  // Log the action
  await logRoleChange(
    AUDIT_ACTIONS.TRAINER_ASSIGNED,
    adminId, // Who made the change
    userId,  // Who was promoted
    ROLES.USER, // Old role
    ROLES.TRAINER, // New role
    clubId
  );
};
```

### Example 4: Check resource permission

```javascript
import { canUserAccessResource } from '../firebase/privileges';
import { PERMISSIONS } from '../constants/roles';

const deleteEvent = async (userId, eventId) => {
  const result = await canUserAccessResource(
    userId, 
    'event', 
    eventId, 
    PERMISSIONS.DELETE_EVENT
  );
  
  if (!result.allowed) {
    toast.error(result.reason);
    return;
  }
  
  // Proceed with deletion
  await deleteDoc(doc(db, 'events', eventId));
};
```

### Example 5: Prevent removing last trainer

```javascript
import { canRemoveTrainerFromTeam } from '../firebase/privileges';

const removeTrainerFromTeam = async (clubId, teamId, trainerId) => {
  const result = await canRemoveTrainerFromTeam(clubId, teamId, trainerId);
  
  if (!result.allowed) {
    toast.error(result.reason);
    return;
  }
  
  // Proceed with removal
  // ... update Firestore ...
};
```

---

## Security Rules

**File**: `firestore.rules`

Comprehensive Firestore security rules enforce permissions at the database level.

### Key Security Features:

1. **Authentication Required**: All operations require authentication
2. **Role-Based Access**: Rules check user roles and ownership
3. **Subscription Validation**: Club management requires active subscriptions
4. **Membership Checks**: Users can only access resources they're members of
5. **Admin Override**: Admins can access everything (for support)
6. **Immutable Audit Logs**: Audit logs cannot be modified once created

### Example Rule:

```javascript
match /clubs/{clubId} {
  // Club members can read club data, admins can read all
  allow read: if isAdmin() || isClubMember(clubId);
  
  // Only club owners (with active subscription) or admins can update clubs
  allow update: if isAdmin() || 
                   (isClubOwner(clubId) && hasActiveSubscription(request.auth.uid));
}
```

---

## Audit Logging

Every permission change and important action is logged to the `auditLogs` collection.

### Logged Actions:
- ✅ Club creation, modification, deletion
- ✅ Team creation, modification, deletion
- ✅ Role promotions and demotions
- ✅ Trainer/Assistant assignments
- ✅ Member additions and removals
- ✅ Ownership transfers
- ✅ Event creation, modification, deletion
- ✅ Permission grants and revocations
- ✅ Subscription changes

### Audit Log Structure:

```javascript
{
  action: 'role_promoted',
  timestamp: Timestamp,
  granterId: 'user123',
  targetUserId: 'user456',
  oldRole: 'user',
  newRole: 'trainer',
  clubId: 'club789',
  resourceType: 'user',
  resourceId: 'user456',
  userAgent: 'Mozilla/5.0...'
}
```

### Viewing Audit Logs:

```javascript
import { getClubAuditLogs, formatAuditLog } from '../utils/auditLogger';

const viewClubHistory = async (clubId) => {
  const logs = await getClubAuditLogs(clubId, 100);
  const formatted = logs.map(formatAuditLog);
  
  formatted.forEach(log => {
    console.log(`${log.timeStr}: ${log.message}`);
  });
};
```

### Downloading Audit Logs (Admin Only):

```javascript
import { downloadAuditLogsCSV } from '../utils/auditLogger';

const exportLogs = async () => {
  await downloadAuditLogsCSV(
    { clubId: 'club123' }, 
    'club-history.csv'
  );
};
```

---

## Testing Guide

### Test Checklist:

#### Admin Role:
- ✅ Admin can access everything
- ✅ Admin can promote/demote any user
- ✅ Admin can create/modify/delete any resource
- ✅ Admin can view audit logs
- ✅ Admin actions are logged

#### Club Owner Role:
- ✅ ClubOwner can only manage owned clubs
- ✅ ClubOwner access denied if subscription expired
- ✅ ClubOwner can create/delete teams in their club
- ✅ ClubOwner can assign/unassign trainers
- ✅ ClubOwner can transfer ownership
- ✅ Only ONE ClubOwner per club enforced

#### Trainer Role:
- ✅ Trainer can only see assigned teams
- ✅ Trainer can create team events
- ✅ Trainer can manage team attendance
- ✅ Trainer cannot access other clubs
- ✅ Cannot remove last trainer from team

#### Assistant Role:
- ✅ Assistant has same permissions as Trainer
- ✅ Assistant role is properly distinguished in UI

#### User Role:
- ✅ User can only see clubs/teams they're member of
- ✅ User can create personal events
- ✅ User can create 1-on-1 chats with anyone
- ✅ Users without memberships can still create personal events and chats

#### Permission Validation:
- ✅ Permission denied messages are clear
- ✅ Users are redirected gracefully when denied
- ✅ Subscription checks work correctly
- ✅ Audit log captures all permission changes

#### Edge Cases:
- ✅ User demoted while viewing restricted page → redirect gracefully
- ✅ ClubOwner subscription expires → make club read-only, notify owner
- ✅ Last trainer tries to leave team → prevent or require new trainer first
- ✅ Club ownership transfer → update all related permissions atomically
- ✅ User deleted → remove from all clubs/teams, reassign ownership if needed

---

## Best Practices

### 1. Always Check Permissions Before Actions

```javascript
// ❌ BAD
const deleteClub = async (clubId) => {
  await deleteDoc(doc(db, 'clubs', clubId));
};

// ✅ GOOD
const deleteClub = async (userId, clubId) => {
  const result = await canUserAccessResource(
    userId, 'club', clubId, PERMISSIONS.DELETE_CLUB
  );
  if (!result.allowed) {
    throw new Error(result.reason);
  }
  await deleteDoc(doc(db, 'clubs', clubId));
};
```

### 2. Log Important Actions

```javascript
// ✅ Always log permission changes
await logRoleChange(
  AUDIT_ACTIONS.TRAINER_ASSIGNED,
  granterId,
  targetUserId,
  oldRole,
  newRole,
  clubId
);
```

### 3. Use Constants Instead of Hardcoding

```javascript
// ❌ BAD
if (user.role === 'admin') { ... }

// ✅ GOOD
import { ROLES } from '../constants/roles';
if (user.role === ROLES.ADMIN) { ... }
```

### 4. Provide Clear Error Messages

```javascript
import { PERMISSION_ERRORS } from '../constants/roles';

if (!canManage) {
  toast.error(PERMISSION_ERRORS.NOT_CLUB_OWNER);
}
```

### 5. Handle Subscription Expiry Gracefully

```javascript
const hasSubscription = await hasActiveClubSubscription(userId);
if (!hasSubscription) {
  // Show renewal prompt instead of hard blocking
  showSubscriptionRenewalModal();
  return;
}
```

---

## Troubleshooting

### Issue: User can't access club they should have access to

**Solution**: Check if user is properly added to club's members array in Firestore

### Issue: Subscription check always fails

**Solution**: Verify `subscriptionStatus` field in user document is set to 'active' or 'trial'

### Issue: Audit logs not showing up

**Solution**: Check Firestore security rules allow write to `auditLogs` collection

### Issue: Last trainer can be removed from team

**Solution**: Ensure `canRemoveTrainerFromTeam` function is called before removal

---

## Support

For questions or issues with the privilege system, contact the development team or create an issue in the repository.

---

**Last Updated**: December 2025
**Version**: 1.0.0





