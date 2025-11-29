# Deploy Firestore Security Rules

## Quick Start

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

This will open your browser for authentication.

### Step 3: Deploy the Rules

```bash
cd /c/Users/kicka/Documents/MyApps/Nexus/nexus-app
firebase deploy --only firestore:rules
```

That's it! Your security rules are now deployed.

---

## Verify Deployment

### Method 1: Firebase Console
1. Go to https://console.firebase.google.com/
2. Select your project: **nexus-app-c69da**
3. Navigate to **Firestore Database** → **Rules**
4. You should see your deployed rules with timestamp

### Method 2: Command Line
```bash
firebase firestore:rules
```

---

## Testing Your Rules

### Option 1: Firebase Console Rules Playground
1. Firebase Console → Firestore Database → Rules
2. Click "Rules Playground" tab
3. Simulate operations with different auth states

Example tests:
- Authenticated user reading their profile: **Should SUCCEED**
- Unauthenticated user reading data: **Should FAIL**
- User trying to update another user's profile: **Should FAIL**
- Admin updating any user: **Should SUCCEED**

### Option 2: Test in Your Application
1. Start your dev server: `npm run dev`
2. Test with different user roles:
   - Create a regular user account
   - Try to access admin functions (should fail)
   - Join a club and access club data (should succeed)

---

## What the Rules Protect

✅ **Users Collection**
- Users can only edit their own profile
- Cannot change their own role to admin
- Admins can manage all users

✅ **Clubs Collection**
- Only club members can read club data
- Only trainers/admins can create clubs
- Only club managers can update clubs

✅ **Events Collection**
- Only club members can see club events
- Only trainers/assistants can create events
- Event creators and club managers can edit

✅ **Requests Collection**
- Users see only their own requests
- Club trainers can approve/deny requests
- Proper validation on status changes

---

## Rollback (If Needed)

If you need to rollback to previous rules:

```bash
# View deployment history
firebase firestore:rules list

# Rollback to specific version
firebase firestore:rules rollback <version_number>
```

---

## Common Issues

### Issue: "Permission denied"
**Solution:** Make sure you're logged in with the correct Google account that has access to the Firebase project.

```bash
firebase logout
firebase login
```

### Issue: "Project not found"
**Solution:** Verify your project ID in `.firebaserc` matches your Firebase project.

### Issue: Rules don't seem to apply
**Solution:** 
1. Check deployment was successful
2. Clear your app's cache
3. Hard refresh your browser (Ctrl+Shift+R)
4. Check Firebase Console to confirm rules are deployed

---

## Next Steps

After deploying rules:

1. **Test thoroughly** with different user roles
2. **Monitor Firebase Console** → Usage tab for denied requests
3. **Set up indexes** if you see index warnings
4. **Review regularly** as you add new features

---

## Updating Rules

When you modify `firestore.rules`:

1. Edit the file locally
2. Test changes if possible
3. Deploy: `firebase deploy --only firestore:rules`
4. Verify in Firebase Console
5. Test in your application

---

## Firebase CLI Cheatsheet

```bash
# Login
firebase login

# Deploy only rules
firebase deploy --only firestore:rules

# Deploy everything (rules + hosting)
firebase deploy

# Check current project
firebase projects:list
firebase use

# View deployment history
firebase firestore:rules list

# Emulator (for local testing)
firebase emulators:start
```

---

**Project:** nexus-app-c69da
**Rules File:** firestore.rules
**Last Updated:** 2025-11-28
