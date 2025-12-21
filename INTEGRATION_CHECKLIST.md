# Integration Checklist - Privileges & Access Control

Use this checklist to ensure proper integration of the privileges and access control system into your Nexus application.

---

## Phase 1: Initial Setup

### 1.1 Deploy Firestore Security Rules
- [ ] Review `firestore.rules` file
- [ ] Test rules in Firebase console
- [ ] Deploy rules to production
  ```bash
  firebase deploy --only firestore:rules
  ```
- [ ] Verify rules are active in Firebase Console

### 1.2 Update Firebase Indexes (if needed)
- [ ] Check Firestore logs for missing indexes
- [ ] Create required composite indexes
- [ ] Wait for indexes to build

### 1.3 Verify Constants
- [ ] Review `src/constants/roles.js`
- [ ] Ensure role names match your user documents
- [ ] Verify permission constants are complete
- [ ] Check error messages are appropriate for your app

---

## Phase 2: User Data Migration

### 2.1 Update User Documents
- [ ] Add `role` field to all user documents (default: 'user')
- [ ] Add `ownedClubs` array to club owners
- [ ] Add `subscriptionStatus` field to users with subscriptions
- [ ] Add `subscriptionPlan` field ('club', 'user', 'full')
- [ ] Verify `isSuperAdmin` field for admins

**Migration Script Example**:
```javascript
const migrateUsers = async () => {
  const users = await getDocs(collection(db, 'users'));
  
  for (const userDoc of users.docs) {
    const updates = {};
    
    // Set default role if missing
    if (!userDoc.data().role) {
      updates.role = 'user';
    }
    
    // Initialize owned clubs array
    if (!userDoc.data().ownedClubs) {
      updates.ownedClubs = [];
    }
    
    // Set subscription status
    if (!userDoc.data().subscriptionStatus) {
      updates.subscriptionStatus = 'expired';
    }
    
    if (Object.keys(updates).length > 0) {
      await updateDoc(userDoc.ref, updates);
    }
  }
};
```

### 2.2 Update Club Documents
- [ ] Add `ownerId` field to all clubs (set to creator)
- [ ] Populate `members` array
- [ ] Populate `trainers` array
- [ ] Populate `assistants` array
- [ ] Update club owners' `ownedClubs` arrays

**Migration Script Example**:
```javascript
const migrateClubs = async () => {
  const clubs = await getDocs(collection(db, 'clubs'));
  
  for (const clubDoc of clubs.docs) {
    const clubData = clubDoc.data();
    const updates = {};
    
    // Set owner
    if (!clubData.ownerId && clubData.createdBy) {
      updates.ownerId = clubData.createdBy;
      
      // Update user's ownedClubs
      const userRef = doc(db, 'users', clubData.createdBy);
      await updateDoc(userRef, {
        ownedClubs: arrayUnion(clubDoc.id)
      });
    }
    
    // Initialize arrays
    if (!clubData.members) updates.members = [];
    if (!clubData.trainers) updates.trainers = [];
    if (!clubData.assistants) updates.assistants = [];
    
    if (Object.keys(updates).length > 0) {
      await updateDoc(clubDoc.ref, updates);
    }
  }
};
```

### 2.3 Update Team Documents
- [ ] Ensure teams have `createdBy` field
- [ ] Populate `trainers` array (at least 1 trainer per team)
- [ ] Populate `assistants` array
- [ ] Populate `members` array

---

## Phase 3: Code Integration

### 3.1 Update Imports
- [ ] Replace hardcoded role strings with `ROLES` constants
- [ ] Replace hardcoded permission checks with `PERMISSIONS` constants
- [ ] Update error messages to use `PERMISSION_ERRORS`

**Before**:
```javascript
if (user.role === 'admin') { ... }
```

**After**:
```javascript
import { ROLES } from '../constants/roles';
if (user.role === ROLES.ADMIN) { ... }
```

### 3.2 Add Permission Checks to Pages
- [ ] Club management pages
- [ ] Team management pages
- [ ] Event creation/editing pages
- [ ] Chat creation pages
- [ ] User management pages
- [ ] Admin dashboard
- [ ] Settings pages

### 3.3 Add Permission Checks to Components
- [ ] Management buttons
- [ ] Edit/delete buttons
- [ ] Role assignment dropdowns
- [ ] Navigation menus
- [ ] Conditional rendering

### 3.4 Add Permission Checks to API Calls
- [ ] Club creation
- [ ] Club updates
- [ ] Club deletion
- [ ] Team creation
- [ ] Team updates
- [ ] Event creation
- [ ] Role assignments
- [ ] Member management

---

## Phase 4: Audit Logging Integration

### 4.1 Add Logging to Role Changes
- [ ] User promotion/demotion
- [ ] Trainer assignment/removal
- [ ] Assistant assignment/removal
- [ ] Admin promotion

**Example**:
```javascript
import { logRoleChange } from '../utils/auditLogger';
import { AUDIT_ACTIONS, ROLES } from '../constants/roles';

// After role change
await logRoleChange(
  AUDIT_ACTIONS.ROLE_PROMOTED,
  currentUser.id,
  targetUser.id,
  ROLES.USER,
  ROLES.TRAINER,
  clubId
);
```

### 4.2 Add Logging to Club Actions
- [ ] Club creation
- [ ] Club updates
- [ ] Club deletion
- [ ] Ownership transfers

### 4.3 Add Logging to Team Actions
- [ ] Team creation
- [ ] Team updates
- [ ] Team deletion
- [ ] Member additions/removals

### 4.4 Add Logging to Event Actions
- [ ] Event creation
- [ ] Event modifications
- [ ] Event deletions

---

## Phase 5: UI Components

### 5.1 Create Required Components
- [ ] AccessDenied component
- [ ] SubscriptionRequired component
- [ ] PermissionError component
- [ ] LoadingSpinner component

**AccessDenied Example**:
```javascript
const AccessDenied = ({ message, redirectTo }) => {
  return (
    <div className="access-denied">
      <h2>Access Denied</h2>
      <p>{message || 'You do not have permission to view this page.'}</p>
      {redirectTo && (
        <button onClick={() => navigate(redirectTo)}>
          Go Back
        </button>
      )}
    </div>
  );
};
```

### 5.2 Update Existing Components
- [ ] Add permission checks to buttons
- [ ] Add loading states for async permission checks
- [ ] Add error displays for permission denials
- [ ] Add role badges to user cards

### 5.3 Create Admin Components (if needed)
- [ ] AuditLogViewer component
- [ ] UserRoleManager component
- [ ] SubscriptionManager component
- [ ] PermissionTester component

---

## Phase 6: Testing

### 6.1 Role-Based Testing
- [ ] Test admin access to all features
- [ ] Test club owner access to owned clubs only
- [ ] Test club owner blocked when subscription expires
- [ ] Test trainer access to assigned teams only
- [ ] Test assistant has same permissions as trainer
- [ ] Test user access to member resources only

### 6.2 Permission-Based Testing
- [ ] Test club creation requires subscription
- [ ] Test club management requires ownership + subscription
- [ ] Test team creation requires trainer/owner role
- [ ] Test event creation follows visibility rules
- [ ] Test chat creation follows participant rules

### 6.3 Special Rules Testing
- [ ] Test cannot remove last trainer from team
- [ ] Test only one club owner per club
- [ ] Test trainers see only their teams
- [ ] Test cannot self-promote
- [ ] Test admins cannot be demoted
- [ ] Test ownership transfer updates all permissions

### 6.4 Edge Cases Testing
- [ ] Test user demoted while viewing restricted page
- [ ] Test club owner subscription expires while managing club
- [ ] Test last trainer tries to leave team
- [ ] Test club ownership transfer atomicity
- [ ] Test user deletion (member removal, ownership reassignment)

### 6.5 Audit Logging Testing
- [ ] Test permission changes are logged
- [ ] Test role changes are tracked
- [ ] Test ownership transfers recorded
- [ ] Test audit logs are queryable
- [ ] Test CSV export works (admin only)

---

## Phase 7: Performance Optimization

### 7.1 Caching
- [ ] Implement permission result caching
- [ ] Cache user role in context
- [ ] Cache club membership checks
- [ ] Implement cache invalidation strategy

### 7.2 Query Optimization
- [ ] Review Firestore queries for optimization
- [ ] Add pagination to audit logs
- [ ] Implement lazy loading for large lists
- [ ] Optimize subscription checks

### 7.3 Component Optimization
- [ ] Memoize permission components
- [ ] Use React.memo for permission wrappers
- [ ] Implement loading skeletons
- [ ] Add error boundaries

---

## Phase 8: Documentation

### 8.1 Developer Documentation
- [ ] Review PRIVILEGES_DOCUMENTATION.md
- [ ] Review INTEGRATION_EXAMPLES.md
- [ ] Review QUICK_REFERENCE.md
- [ ] Add team-specific notes

### 8.2 User Documentation
- [ ] Create user guide for roles
- [ ] Document subscription requirements
- [ ] Explain permission denials
- [ ] Create FAQ section

### 8.3 API Documentation
- [ ] Document permission checking functions
- [ ] Document audit logging functions
- [ ] Document middleware usage
- [ ] Document hook usage

---

## Phase 9: Deployment

### 9.1 Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Firestore rules deployed
- [ ] Data migration complete
- [ ] Performance testing done
- [ ] Security review complete

### 9.2 Deployment Steps
1. [ ] Deploy Firestore rules
2. [ ] Deploy code to staging
3. [ ] Run smoke tests on staging
4. [ ] Deploy to production
5. [ ] Monitor error logs
6. [ ] Monitor audit logs

### 9.3 Post-Deployment Verification
- [ ] Test admin access
- [ ] Test club owner access
- [ ] Test subscription checks
- [ ] Test audit logging
- [ ] Monitor user feedback

---

## Phase 10: Monitoring & Maintenance

### 10.1 Set Up Monitoring
- [ ] Monitor permission denial errors
- [ ] Monitor subscription check failures
- [ ] Monitor audit log writes
- [ ] Set up alerts for critical errors

### 10.2 Regular Maintenance
- [ ] Review audit logs weekly
- [ ] Clean up old audit logs (after 1 year)
- [ ] Review permission denied errors
- [ ] Update documentation as needed

### 10.3 User Support
- [ ] Create support documentation for permission issues
- [ ] Train support team on role system
- [ ] Create troubleshooting guide
- [ ] Set up feedback mechanism

---

## Troubleshooting Common Issues

### Issue: Firestore rules deny legitimate access
**Solution**: Check rule syntax, verify user document structure matches rules

### Issue: Permission checks are slow
**Solution**: Implement caching, optimize Firestore queries

### Issue: Audit logs not appearing
**Solution**: Check Firestore rules allow write, verify function calls

### Issue: Users see brief flash of unauthorized content
**Solution**: Add loading states, use suspense boundaries

### Issue: Subscription checks always fail
**Solution**: Verify `subscriptionStatus` field exists and is 'active' or 'trial'

---

## Support Contacts

- **Technical Issues**: [Your Dev Team Email]
- **Security Concerns**: [Security Team Email]
- **Documentation Updates**: [Documentation Team Email]

---

## Version History

- **v1.0.0** (December 2025) - Initial implementation

---

## Sign-Off

Once all items are checked, have the following sign-off:

- [ ] Backend Lead: _____________________ Date: _________
- [ ] Frontend Lead: _____________________ Date: _________
- [ ] Security Lead: _____________________ Date: _________
- [ ] QA Lead: _____________________ Date: _________
- [ ] Product Owner: _____________________ Date: _________

---

**Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete

Mark your progress as you go through this checklist!

