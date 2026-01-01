# 🎨 Permission System UI Components - Usage Guide

## Quick Start Examples

### 1️⃣ **Protect Entire Pages**

```jsx
// src/pages/AdminDashboard.jsx
import { RequireAdmin } from '../components/PermissionGuard';

export default function AdminDashboard() {
  return (
    <RequireAdmin>
      {/* Your admin content here */}
      <div className="p-6">
        <h1>Admin Dashboard</h1>
        {/* ... rest of your admin UI */}
      </div>
    </RequireAdmin>
  );
}
```

### 2️⃣ **Show/Hide UI Elements**

```jsx
// Show delete button only to admins and creators
import { ShowIf } from '../components/PermissionGuard';

<ShowIf condition={({ user, isAdmin }) => isAdmin || event.createdBy === user.id}>
  <button onClick={handleDelete} className="bg-red-600 px-4 py-2 rounded">
    Delete Event
  </button>
</ShowIf>

// Hide element from regular users
import { HideIf } from '../components/PermissionGuard';

<HideIf condition="user">
  <button>Admin Action</button>
</HideIf>
```

### 3️⃣ **Display User Roles**

```jsx
// In user cards, member lists, etc.
import RoleBadge, { RoleBadgeCompact } from '../components/RoleBadge';

{/* Full size badge */}
<RoleBadge role={user.role} isSuperAdmin={user.isSuperAdmin} />

{/* Compact badge (for lists) */}
<RoleBadgeCompact role={user.role} isSuperAdmin={user.isSuperAdmin} />

{/* Icon only */}
<RoleIcon role={user.role} size="lg" />
```

### 4️⃣ **Subscription Paywalls**

```jsx
// Wrap premium features
import { RequireSubscription } from '../components/PermissionGuard';
import { FeatureLocked } from '../components/SubscriptionRequired';

{/* Block entire feature */}
<RequireSubscription>
  <AdvancedAnalytics />
</RequireSubscription>

{/* Custom feature lock */}
<RequireSubscription 
  fallback={<FeatureLocked featureName="Advanced Team Statistics" />}
>
  <TeamStats />
</RequireSubscription>
```

### 5️⃣ **Resource-Specific Permissions**

```jsx
// Check specific permission for a resource
import { RequirePermission } from '../components/PermissionGuard';
import { PERMISSIONS } from '../constants/roles';

<RequirePermission
  resourceType="club"
  resourceId={clubId}
  action={PERMISSIONS.MANAGE_CLUB}
  fallbackMessage="You must be a club owner to manage this club."
>
  <ClubSettings clubId={clubId} />
</RequirePermission>
```

---

## 🔥 Real Integration Examples

### **Example 1: Event.jsx - Add Delete Button with Permission**

```jsx
import { ShowIf } from '../components/PermissionGuard';

// Inside your Event component JSX:
<div className="flex gap-2">
  <button onClick={handleEdit}>Edit</button>
  
  {/* Show delete button only if user can manage event */}
  <ShowIf condition={canManageEvent()}>
    <button 
      onClick={handleDelete}
      className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
    >
      Delete Event
    </button>
  </ShowIf>
</div>
```

### **Example 2: AdminDashboard - Show Role Badges**

```jsx
import RoleBadge from '../components/RoleBadge';

// In your users list:
{users.map(u => (
  <div key={u.id} className="flex items-center gap-3 p-4">
    <span>{u.username}</span>
    <RoleBadge role={u.role} isSuperAdmin={u.isSuperAdmin} size="sm" />
    <span className="text-sm text-light/60">{u.email}</span>
  </div>
))}
```

### **Example 3: ClubManagement - Hide Admin Actions**

```jsx
import { ShowIf } from '../components/PermissionGuard';

// Only show to admins and club owners
<ShowIf condition={({ isAdmin }) => isAdmin || isClubManager(club)}>
  <button onClick={handleDeleteClub}>
    Delete Club
  </button>
</ShowIf>

// Show to trainers and above
<ShowIf condition={({ user }) => 
  ['admin', 'trainer', 'assistant'].includes(user?.role)
}>
  <button onClick={handleCreateTeam}>
    Create Team
  </button>
</ShowIf>
```

### **Example 4: Navbar - Role-Based Menu Items**

```jsx
import { ShowIf } from '../components/PermissionGuard';

<nav>
  <Link to="/dashboard">Dashboard</Link>
  
  {/* Only show to managers */}
  <ShowIf condition={({ user }) => 
    ['admin', 'trainer', 'assistant'].includes(user?.role)
  }>
    <Link to="/club-management">Club Management</Link>
  </ShowIf>
  
  {/* Only show to admins */}
  <ShowIf condition="admin">
    <Link to="/admin">Admin Panel</Link>
  </ShowIf>
</nav>
```

### **Example 5: NewEvent - Subscription Check**

```jsx
import { RequireSubscription } from '../components/PermissionGuard';

// Wrap the club event creation
{canCreateClubEvents && (
  <RequireSubscription hideOnDeny>
    <option value="club">Club Event</option>
  </RequireSubscription>
)}
```

---

## 🎨 Styling Tips

### Custom Fallback Component

```jsx
import AccessDenied from '../components/AccessDenied';

<RequireAdmin 
  fallback={
    <AccessDenied 
      title="Trainers Only"
      message="Only trainers can create team events."
      icon="⚽"
    />
  }
>
  <CreateEventForm />
</RequireAdmin>
```

### Inline Permission Check (No Wrapper)

```jsx
import { useIsAdmin } from '../hooks/usePermissions';

const isUserAdmin = useIsAdmin();

// Then use it directly
{isUserAdmin && <AdminButton />}
```

---

## 🔧 Common Patterns

### Pattern 1: "Edit" vs "View" Mode

```jsx
const canEdit = canManageEvent();

<div>
  {canEdit ? (
    <EditEventForm event={event} />
  ) : (
    <ViewEventDetails event={event} />
  )}
</div>
```

### Pattern 2: Multiple Conditions (OR logic)

```jsx
<ShowIf 
  condition={[
    ({ isAdmin }) => isAdmin,
    ({ user }) => event.createdBy === user.id,
    ({ user }) => isClubOwner(user, event.clubId)
  ]}
  or={true}
>
  <EditButton />
</ShowIf>
```

### Pattern 3: Loading State with Permission Check

```jsx
<RequirePermission
  resourceType="team"
  resourceId={teamId}
  action={PERMISSIONS.MANAGE_TEAM}
>
  {loading ? <Spinner /> : <TeamSettings />}
</RequirePermission>
```

### Pattern 4: Graceful Degradation

```jsx
// Show limited features to non-subscribers
<div>
  <BasicFeatures />
  
  <RequireSubscription hideOnDeny>
    <PremiumFeatures />
  </RequireSubscription>
</div>
```

---

## 📦 Import Cheatsheet

```jsx
// Permission Guards
import PermissionGuard, { 
  RequireAuth, 
  RequireAdmin, 
  RequireSubscription,
  RequirePermission,
  ShowIf,
  HideIf 
} from '../components/PermissionGuard';

// Fallback Components
import AccessDenied, { 
  NotAuthenticated, 
  NotAdmin, 
  NotClubOwner 
} from '../components/AccessDenied';

import SubscriptionRequired, { 
  SubscriptionExpired, 
  FeatureLocked 
} from '../components/SubscriptionRequired';

// Visual Components
import RoleBadge, { 
  RoleBadgeCompact, 
  RoleIcon, 
  MultiRoleBadge 
} from '../components/RoleBadge';

// Hooks
import { 
  useIsAdmin, 
  usePermission, 
  useHasSubscription,
  useCan 
} from '../hooks/usePermissions';

// Constants
import { PERMISSIONS, ROLES } from '../constants/roles';
```

---

## 🚀 Migration Steps

1. **Start with critical pages** (AdminDashboard, ClubManagement)
2. **Add role badges** to user displays
3. **Use ShowIf** for buttons/actions
4. **Add RequireAdmin** to protected routes
5. **Test thoroughly** with different roles

Happy coding! 🎉





