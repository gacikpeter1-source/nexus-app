# 🚀 Deployment Guide - Phase 1: User Notification Preferences

## 📋 Pre-Deployment Checklist

### Files Created/Modified

**Created:**
- ✅ `src/firebase/userNotificationPreferences.js` - Preference management functions
- ✅ `src/components/UserNotificationPreferences.jsx` - Comprehensive UI
- ✅ `NOTIFICATION_PREFERENCES_IMPLEMENTATION.md` - Documentation
- ✅ `DEPLOYMENT_GUIDE_PHASE1.md` - This file

**Modified:**
- ✅ `src/components/NotificationSettings.jsx` - Added link to detailed preferences
- ✅ `functions/index.js` - Added preference checking to Cloud Functions
- ✅ `firestore.rules` - Added user settings security rules

## 🔧 Step-by-Step Deployment

### Step 1: Deploy Firestore Security Rules

```bash
# From project root
firebase deploy --only firestore:rules
```

**Expected Output:**
```
✔  Deploy complete!
✔  firestore: released rules firestore.rules to cloud.firestore
```

### Step 2: Deploy Cloud Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies (if needed)
npm install

# Deploy functions
cd ..
firebase deploy --only functions
```

**Expected Output:**
```
✔  functions: Finished running predeploy script.
✔  functions[onEventCreated(us-central1)]: Successful update operation.
✔  functions[onEventUpdated(us-central1)]: Successful update operation.
✔  functions[onEventDeleted(us-central1)]: Successful update operation.
...
✔  Deploy complete!
```

**Note:** If you get timeout errors, deploy functions individually:

```bash
firebase deploy --only functions:onEventCreated
firebase deploy --only functions:onEventUpdated
firebase deploy --only functions:onEventDeleted
```

### Step 3: Build and Deploy Frontend

```bash
# From project root
npm run build

# Deploy to hosting
firebase deploy --only hosting
```

**Expected Output:**
```
✔  hosting: production release deployed
```

**Or deploy to Vercel (if using):**

```bash
vercel --prod
```

### Step 4: Verify Deployment

1. **Check Firestore Rules:**
   - Go to Firebase Console → Firestore Database → Rules
   - Verify you see the new `match /users/{userId}/settings/{settingId}` rule

2. **Check Cloud Functions:**
   - Go to Firebase Console → Functions
   - Verify `onEventCreated`, `onEventUpdated`, `onEventDeleted` show recent deployment time

3. **Check Frontend:**
   - Open your app in a browser
   - Go to Profile → Notifications tab
   - Should see "Detailed Notification Preferences" button
   - Click it → Should see comprehensive preferences UI

## 🧪 Post-Deployment Testing

### Test 1: Default Preferences

```javascript
// In browser console or test file
import { getUserNotificationPreferences } from './src/firebase/userNotificationPreferences';

const prefs = await getUserNotificationPreferences('test-user-id');
console.log(prefs);
// Should show default preferences with masterEnabled: true
```

### Test 2: Update Preferences

1. Go to Profile → Notifications → Detailed Preferences
2. Toggle master switch OFF
3. Refresh page → Should remain OFF
4. Check Firestore:
   ```
   users/{userId}/settings/notificationPreferences
   ```
   Should show `masterEnabled: false`

### Test 3: Notification Filtering

1. Create a test event in your app
2. Check Cloud Function logs:
   ```bash
   firebase functions:log
   ```
3. Should see:
   ```
   👥 Initial target users: X
   📊 Filtered users for eventCreated:
      Push: X
      Email: X
   ```

### Test 4: Quiet Hours

1. Set quiet hours: 22:00 - 07:00
2. Create event outside quiet hours → Should receive notification
3. Create event during quiet hours (use test or change times) → Should NOT receive (unless critical)

### Test 5: Mute Club

1. Go to Detailed Preferences → Scroll to "Mute Clubs & Teams"
2. Toggle a club OFF
3. Create event in that club
4. Should NOT receive notification

## 🔍 Monitoring & Debugging

### Cloud Function Logs

```bash
# Real-time logs
firebase functions:log --only onEventCreated

# Or view in Firebase Console
# Functions → onEventCreated → Logs
```

**What to look for:**
```
👥 Initial target users: 5
📊 Filtered users for eventCreated:
   Push: 3
   Email: 4
   SMS: 0
   Call: 0
✉️ Email queued for 4 recipients
🔔 Sending push to 3 devices
✅ Successfully sent: 3
```

### Firestore Console

Check that preferences are being stored:
```
Collection: users
Document: {userId}
Subcollection: settings
Document: notificationPreferences
```

### Common Issues & Solutions

**Issue 1: Functions timeout during deployment**
```bash
# Solution: Deploy with longer timeout
firebase deploy --only functions --force
```

**Issue 2: "Permission denied" in Firestore**
```bash
# Solution: Redeploy rules
firebase deploy --only firestore:rules
```

**Issue 3: Preferences not saving**
- Check browser console for errors
- Verify user is authenticated
- Check Firestore rules are deployed
- Check user has `userId` in auth

**Issue 4: Still receiving notifications after disabling**
- Check if notification type is "critical" (bypasses quiet hours)
- Verify preferences are saved in Firestore
- Check Cloud Function logs to see filtering results
- Clear notification cache (if any)

## 📊 Performance Monitoring

### Expected Performance

- **Preference Lookup**: < 100ms
- **Filter 100 users**: < 500ms
- **Filter 1000 users**: < 2s

### Optimization Tips

1. **Cache user preferences** (if needed):
   ```javascript
   const prefsCache = new Map();
   
   async function getCachedPreferences(userId) {
     if (prefsCache.has(userId)) {
       return prefsCache.get(userId);
     }
     const prefs = await getUserNotificationPreferences(userId);
     prefsCache.set(userId, prefs);
     return prefs;
   }
   ```

2. **Batch Firestore reads** when filtering large user lists

3. **Monitor Cloud Function execution time** in Firebase Console

## 🎯 Rollback Plan (If Needed)

### Quick Rollback

```bash
# Rollback to previous version of functions
firebase functions:config:set --project=your-project-id

# Or deploy previous version
git checkout previous-commit-hash
firebase deploy --only functions
```

### Graceful Fallback

The system is designed to **fail open**:
- If preferences can't be loaded → Notifications still sent (default allow)
- If filtering fails → Falls back to sending to all users
- No breaking changes to existing notification flow

## ✅ Deployment Complete Checklist

- [ ] Firestore rules deployed successfully
- [ ] Cloud Functions deployed successfully
- [ ] Frontend deployed successfully
- [ ] Can access Detailed Preferences UI
- [ ] Preferences save correctly
- [ ] Event notifications respect preferences
- [ ] Quiet hours work correctly
- [ ] Mute clubs/teams work correctly
- [ ] Logs show filtering happening
- [ ] Performance is acceptable (< 2s for filtering)

## 📞 Support

If you encounter issues:

1. Check Cloud Function logs: `firebase functions:log`
2. Check browser console for frontend errors
3. Verify Firestore rules are active
4. Test with a simple event creation
5. Check user authentication status

## 🎉 Success Indicators

You'll know deployment was successful when:

1. ✅ Users can access Detailed Preferences UI
2. ✅ Users can toggle preferences and they persist
3. ✅ Cloud Function logs show preference filtering
4. ✅ Users with notifications disabled don't receive them
5. ✅ Muted clubs don't send notifications
6. ✅ Quiet hours are respected (except critical notifications)

---

**Deployment Time Estimate:** 15-30 minutes

**Rollback Time Estimate:** 5-10 minutes (if needed)

**Testing Time Estimate:** 30-45 minutes

**Total:** ~1-2 hours for complete deployment and verification






