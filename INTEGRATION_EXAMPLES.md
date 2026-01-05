# Integration Examples for Privileges & Access Control

This document provides practical examples of integrating the privilege system into your Nexus application.

## Table of Contents
1. [Protecting Pages/Routes](#protecting-pagesroutes)
2. [Conditional UI Rendering](#conditional-ui-rendering)
3. [Form Submission Guards](#form-submission-guards)
4. [Role-Based Navigation](#role-based-navigation)
5. [Real-World Component Examples](#real-world-component-examples)

---

## Protecting Pages/Routes

### Example 1: Protect Club Management Page

```jsx
// src/pages/ClubManagement.jsx
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { requireClubOwner } from '../middleware/checkAccess';

const ClubManagement = () => {
  const { clubId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

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

  return (
    <div>
      <h1>Club Management</h1>
      {/* Club management UI */}
    </div>
  );
};

export default ClubManagement;
```

### Example 2: Protect Admin Dashboard (Simple)

```jsx
// src/pages/AdminDashboard.jsx
import { useIsAdmin } from '../hooks/usePermissions';
import { Navigate } from 'react-router-dom';

const AdminDashboard = () => {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {/* Admin content */}
    </div>
  );
};

export default AdminDashboard;
```

### Example 3: Protected Route Wrapper

```jsx
// src/components/ProtectedRoute.jsx
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { requireAuth } from '../middleware/checkAccess';

const ProtectedRoute = ({ children, requireAdmin = false, requireSubscription = false }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (loading) return;

      const result = await requireAuth(user);
      if (!result.allowed) {
        setIsAuthorized(false);
        return;
      }

      // Additional checks...
      setIsAuthorized(true);
    };

    checkAuth();
  }, [user, loading]);

  if (loading || isAuthorized === null) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
```

---

## Conditional UI Rendering

### Example 1: Show/Hide Management Buttons

```jsx
// src/components/ClubHeader.jsx
import { useIsClubOwner, useIsAdmin } from '../hooks/usePermissions';

const ClubHeader = ({ club }) => {
  const isOwner = useIsClubOwner(club.id);
  const isAdmin = useIsAdmin();
  const canManage = isOwner || isAdmin;

  return (
    <div className="club-header">
      <h1>{club.name}</h1>
      
      {canManage && (
        <div className="management-buttons">
          <button onClick={() => navigate(`/club/${club.id}/settings`)}>
            ⚙️ Settings
          </button>
          <button onClick={() => navigate(`/club/${club.id}/members`)}>
            👥 Manage Members
          </button>
        </div>
      )}
    </div>
  );
};
```

### Example 2: Conditional Event Creation Button

```jsx
// src/components/EventList.jsx
import { useCan } from '../hooks/usePermissions';

const EventList = ({ clubId, teamId }) => {
  const canCreateClubEvent = useCan('createClubEvent', { clubId });
  const canCreateTeamEvent = useCan('createTeamEvent', { clubId, teamId });

  return (
    <div>
      <h2>Events</h2>
      
      {canCreateClubEvent && (
        <button onClick={createClubEvent}>
          + Create Club Event
        </button>
      )}
      
      {canCreateTeamEvent && (
        <button onClick={createTeamEvent}>
          + Create Team Event
        </button>
      )}
      
      {/* Event list */}
    </div>
  );
};
```

### Example 3: Role-Based Badges

```jsx
// src/components/UserCard.jsx
import { useClubRole } from '../hooks/usePermissions';
import { getRoleDisplayName } from '../constants/roles';

const UserCard = ({ user, clubId }) => {
  const { role, loading } = useClubRole(clubId);

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-500';
      case 'clubOwner': return 'bg-yellow-500';
      case 'trainer': return 'bg-blue-500';
      case 'assistant': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="user-card">
      <img src={user.avatar} alt={user.username} />
      <h3>{user.username}</h3>
      
      {!loading && role && (
        <span className={`role-badge ${getRoleBadgeColor(role)}`}>
          {getRoleDisplayName(role)}
        </span>
      )}
    </div>
  );
};
```

---

## Form Submission Guards

### Example 1: Validate Permission Before Club Update

```jsx
// src/components/ClubSettingsForm.jsx
import { useState } from 'react';
import { usePermission } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';
import { updateClub } from '../firebase/firestore';
import { logClubAction } from '../utils/auditLogger';
import { AUDIT_ACTIONS } from '../constants/roles';

const ClubSettingsForm = ({ club, user }) => {
  const { allowed, loading } = usePermission(
    'club', 
    club.id, 
    PERMISSIONS.MANAGE_CLUB
  );
  const [formData, setFormData] = useState({
    name: club.name,
    description: club.description,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!allowed) {
      toast.error('You do not have permission to update this club');
      return;
    }

    try {
      await updateClub(club.id, formData);
      
      // Log the action
      await logClubAction(
        AUDIT_ACTIONS.CLUB_MODIFIED,
        user.id,
        club.id,
        { changes: formData }
      );
      
      toast.success('Club updated successfully');
    } catch (error) {
      toast.error('Failed to update club');
    }
  };

  if (loading) return <div>Loading...</div>;

  if (!allowed) {
    return <div>You don't have permission to edit this club.</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <button type="submit">Save Changes</button>
    </form>
  );
};
```

### Example 2: Role Assignment with Validation

```jsx
// src/components/AssignRoleModal.jsx
import { useState } from 'react';
import { canAssignRole } from '../firebase/privileges';
import { logRoleChange } from '../utils/auditLogger';
import { AUDIT_ACTIONS, ROLES } from '../constants/roles';

const AssignRoleModal = ({ targetUser, clubId, currentUser }) => {
  const [selectedRole, setSelectedRole] = useState(ROLES.USER);
  const [error, setError] = useState(null);

  const handleAssignRole = async () => {
    // Check permission
    const result = await canAssignRole(
      currentUser.id,
      targetUser.id,
      selectedRole,
      clubId
    );

    if (!result.allowed) {
      setError(result.reason);
      return;
    }

    try {
      // Update role in Firestore...
      // await updateUserRole(targetUser.id, selectedRole);

      // Log the change
      await logRoleChange(
        AUDIT_ACTIONS.ROLE_PROMOTED,
        currentUser.id,
        targetUser.id,
        targetUser.role,
        selectedRole,
        clubId
      );

      toast.success('Role assigned successfully');
    } catch (error) {
      setError('Failed to assign role');
    }
  };

  return (
    <div className="modal">
      <h2>Assign Role to {targetUser.username}</h2>
      
      <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
        <option value={ROLES.USER}>User</option>
        <option value={ROLES.ASSISTANT}>Assistant</option>
        <option value={ROLES.TRAINER}>Trainer</option>
      </select>

      {error && <div className="error">{error}</div>}

      <button onClick={handleAssignRole}>Assign Role</button>
    </div>
  );
};
```

---

## Role-Based Navigation

### Example 1: Dynamic Navigation Menu

```jsx
// src/components/Navbar.jsx
import { useIsAdmin, useHasSubscription } from '../hooks/usePermissions';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const isAdmin = useIsAdmin();
  const { hasSubscription } = useHasSubscription();

  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/clubs">Clubs</Link>
      <Link to="/calendar">Calendar</Link>
      <Link to="/chats">Chats</Link>
      
      {hasSubscription && (
        <Link to="/create-club">Create Club</Link>
      )}
      
      {isAdmin && (
        <>
          <Link to="/admin">Admin Dashboard</Link>
          <Link to="/admin/vouchers">Vouchers</Link>
          <Link to="/admin/audit-logs">Audit Logs</Link>
        </>
      )}
      
      <Link to="/profile">Profile</Link>
    </nav>
  );
};
```

### Example 2: Club-Specific Menu

```jsx
// src/components/ClubMenu.jsx
import { useIsClubOwner, useIsAdmin } from '../hooks/usePermissions';
import { Link } from 'react-router-dom';

const ClubMenu = ({ clubId }) => {
  const isOwner = useIsClubOwner(clubId);
  const isAdmin = useIsAdmin();
  const canManage = isOwner || isAdmin;

  return (
    <div className="club-menu">
      <Link to={`/club/${clubId}`}>Overview</Link>
      <Link to={`/club/${clubId}/teams`}>Teams</Link>
      <Link to={`/club/${clubId}/events`}>Events</Link>
      <Link to={`/club/${clubId}/members`}>Members</Link>
      
      {canManage && (
        <>
          <Link to={`/club/${clubId}/settings`}>Settings</Link>
          <Link to={`/club/${clubId}/orders`}>Orders</Link>
          <Link to={`/club/${clubId}/attendance`}>Attendance</Link>
        </>
      )}
    </div>
  );
};
```

---

## Real-World Component Examples

### Example 1: Event Card with Conditional Actions

```jsx
// src/components/EventCard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canUserAccessResource } from '../firebase/privileges';
import { PERMISSIONS } from '../constants/roles';

const EventCard = ({ event }) => {
  const { user } = useAuth();
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user) return;

      const editResult = await canUserAccessResource(
        user.id,
        'event',
        event.id,
        PERMISSIONS.MODIFY_EVENT
      );
      setCanEdit(editResult.allowed);

      const deleteResult = await canUserAccessResource(
        user.id,
        'event',
        event.id,
        PERMISSIONS.DELETE_EVENT
      );
      setCanDelete(deleteResult.allowed);
    };

    checkPermissions();
  }, [user, event.id]);

  return (
    <div className="event-card">
      <h3>{event.title}</h3>
      <p>{event.description}</p>
      <p>Date: {new Date(event.start).toLocaleDateString()}</p>

      <div className="event-actions">
        {canEdit && (
          <button onClick={() => navigate(`/event/${event.id}/edit`)}>
            ✏️ Edit
          </button>
        )}
        
        {canDelete && (
          <button onClick={handleDelete} className="danger">
            🗑️ Delete
          </button>
        )}
        
        <button onClick={handleRSVP}>
          RSVP
        </button>
      </div>
    </div>
  );
};
```

### Example 2: Team Management with Trainer Validation

```jsx
// src/components/TeamManagement.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canRemoveTrainerFromTeam } from '../firebase/privileges';
import { PERMISSION_ERRORS } from '../constants/roles';

const TeamManagement = ({ club, team }) => {
  const { user } = useAuth();

  const handleRemoveTrainer = async (trainerId) => {
    // Validate before removal
    const result = await canRemoveTrainerFromTeam(club.id, team.id, trainerId);

    if (!result.allowed) {
      toast.error(result.reason || PERMISSION_ERRORS.CANNOT_REMOVE_LAST_TRAINER);
      return;
    }

    try {
      // Remove trainer from team...
      toast.success('Trainer removed successfully');
    } catch (error) {
      toast.error('Failed to remove trainer');
    }
  };

  return (
    <div className="team-management">
      <h2>Team: {team.name}</h2>
      
      <div className="trainers-section">
        <h3>Trainers</h3>
        {team.trainers?.map(trainerId => (
          <div key={trainerId} className="trainer-item">
            <span>{trainerId}</span>
            <button onClick={() => handleRemoveTrainer(trainerId)}>
              Remove
            </button>
          </div>
        ))}
        
        {team.trainers?.length === 1 && (
          <p className="warning">
            ⚠️ At least one trainer is required per team
          </p>
        )}
      </div>
    </div>
  );
};
```

### Example 3: Subscription-Aware Club Creation

```jsx
// src/pages/CreateClubPage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useHasSubscription } from '../hooks/usePermissions';
import { createClub } from '../firebase/firestore';
import { logClubAction } from '../utils/auditLogger';
import { AUDIT_ACTIONS } from '../constants/roles';

const CreateClubPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasSubscription, loading } = useHasSubscription();
  const [clubData, setClubData] = useState({
    name: '',
    description: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasSubscription) {
      toast.error('You need an active Club subscription to create a club');
      navigate('/subscription');
      return;
    }

    try {
      const newClub = await createClub({
        ...clubData,
        ownerId: user.id,
        members: [user.id],
        trainers: [],
        assistants: [],
        teams: [],
      });

      // Log club creation
      await logClubAction(
        AUDIT_ACTIONS.CLUB_CREATED,
        user.id,
        newClub.id,
        { clubName: clubData.name }
      );

      toast.success('Club created successfully');
      navigate(`/club/${newClub.id}`);
    } catch (error) {
      toast.error('Failed to create club');
    }
  };

  if (loading) return <div>Loading...</div>;

  if (!hasSubscription) {
    return (
      <div className="subscription-required">
        <h2>Subscription Required</h2>
        <p>You need an active Club subscription to create a club.</p>
        <button onClick={() => navigate('/subscription')}>
          View Subscription Plans
        </button>
      </div>
    );
  }

  return (
    <div className="create-club-page">
      <h1>Create New Club</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Club Name"
          value={clubData.name}
          onChange={(e) => setClubData({ ...clubData, name: e.target.value })}
          required
        />
        <textarea
          placeholder="Club Description"
          value={clubData.description}
          onChange={(e) => setClubData({ ...clubData, description: e.target.value })}
        />
        <button type="submit">Create Club</button>
      </form>
    </div>
  );
};
```

---

## Testing Your Integration

### Checklist:

1. **Admin Access**:
   - [ ] Admin can access all clubs/teams/events
   - [ ] Admin dashboard is only visible to admins
   - [ ] Admin actions are logged in audit trail

2. **Club Owner Access**:
   - [ ] Club owner can manage their own clubs
   - [ ] Club owner is blocked if subscription expires
   - [ ] Club owner can transfer ownership
   - [ ] Ownership transfer is logged

3. **Trainer Access**:
   - [ ] Trainer can only see their assigned teams
   - [ ] Trainer can create team events
   - [ ] Trainer can manage team attendance
   - [ ] Cannot remove last trainer from team

4. **User Access**:
   - [ ] User can only see clubs they're member of
   - [ ] User can create personal events
   - [ ] User can chat with other users
   - [ ] Permission denied messages are clear

5. **Subscription Checks**:
   - [ ] Club creation requires subscription
   - [ ] Club management requires active subscription
   - [ ] Expired subscriptions show renewal prompt

---

## Troubleshooting Common Issues

### Issue: Hooks return stale data
**Solution**: Make sure dependencies in `useEffect` are properly set

### Issue: Permission checks are slow
**Solution**: Consider caching permission results for frequently checked permissions

### Issue: User sees content briefly before redirect
**Solution**: Use loading state to prevent flash of unauthorized content

---

For more details, see [PRIVILEGES_DOCUMENTATION.md](./PRIVILEGES_DOCUMENTATION.md)







