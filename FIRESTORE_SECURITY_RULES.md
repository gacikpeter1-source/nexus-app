# Firestore Security Rules Documentation

## Overview

This document explains the Firestore security rules implemented for the Nexus Club Management application. These rules protect your database from unauthorized access and ensure that users can only access and modify data they are authorized to work with.

## Security Model

### Role Hierarchy
1. **SuperAdmin** - Full system access (cannot be modified or deleted)
2. **Admin** - Can manage all users, clubs, events, and requests
3. **Trainer** - Can manage clubs they are assigned to and create events
4. **Assistant** - Similar to trainer with limited permissions
5. **User** (Athlete) - Can view club/team data and their events
6. **Parent** - Can view linked athlete data

---

## Collections Security Rules

### 1. Users Collection

#### Read Access
- Any authenticated user can read user profiles (needed for team rosters)

#### Create Access
- Self-registration allowed during account creation
- Cannot set isSuperAdmin flag
- Can only assign roles: user, trainer, or parent

#### Update Access
- Users can update their own profile (except role, isSuperAdmin, email)
- Admins can update any user including roles
- Trainers can update clubIds/teamIds for club members

#### Delete Access
- SuperAdmin can delete any user
- Admins can delete regular users (not SuperAdmin)

### 2. Clubs Collection

#### Read Access
- Admins can read all clubs
- Members, trainers, assistants can read clubs they belong to

#### Create Access
- Trainers, assistants, admins can create clubs
- Must have valid 6-character clubCode

#### Update Access
- Club trainers, assistants, and admins can update

#### Delete Access
- Admins only

### 3. Events Collection

#### Read Access
- Admins can read all events
- Club members can read events from their clubs
- Event creators can read their own events

#### Create Access
- Trainers, assistants, admins can create events
- Must be a member of the club

#### Update/Delete Access
- Event creator, club managers, or admins

### 4. Requests Collection

#### Read Access
- Request creator, club managers, or admins

#### Create Access
- Any authenticated user can create join requests

#### Update Access
- Club managers or admins (for approval/denial)

#### Delete Access
- Request creator (if pending), club managers, or admins

---

## Deployment Instructions

### Step 1: Deploy Rules to Firebase

Using Firebase CLI:

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not done)
firebase init firestore

# Deploy only Firestore rules
firebase deploy --only firestore:rules
```

### Step 2: Verify Deployment

1. Go to Firebase Console
2. Navigate to Firestore Database > Rules
3. Verify the rules are deployed
4. Check the "Rules Playground" to test scenarios

---

## Security Best Practices Implemented

- Principle of Least Privilege
- Role-Based Access Control (RBAC)
- Owner-Based Access
- Input Validation
- SuperAdmin Protection
- Email Immutability
- Default Deny All

---

## Testing Security Rules

Test with different user roles:
- Create test accounts with different roles
- Verify each role can only access appropriate data
- Test denied operations to ensure they fail

---

## Troubleshooting

**Permission Denied Errors:**
1. Check user authentication
2. Verify user role
3. Check club membership
4. Review clubIds array

**Common Issues:**
- User not authenticated
- Missing role in user document
- User not in club members/trainers array

---

Last Updated: 2025-11-28
