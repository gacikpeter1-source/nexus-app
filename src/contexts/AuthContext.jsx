// src/contexts/AuthContext.jsx - WITH DEBUGGING
import { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  deleteUser as deleteUserFromFirestore,
  setUserCustomClaims
} from '../firebase/firestore';
import { removeToken } from '../firebase/messaging';

// Role constants
export const ROLES = {
  ADMIN: 'admin',
  TRAINER: 'trainer',
  ASSISTANT: 'assistant',
  USER: 'user',
  PARENT: 'parent'
};

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Register new user
  const register = async ({ email, password, username, role = 'user' }) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send verification email with static HTML success page
      await sendEmailVerification(userCredential.user, {
        url: 'https://nexus-app-tau.vercel.app/email-verified.html',
        handleCodeInApp: false
      });

      const userData = {
        email: email.toLowerCase(),
        username,
        role,
        emailVerified: false,
        createdAt: new Date().toISOString(), // ✅ Already present
        firstLoginAt: null, // Will be set on first login
        lastLoginAt: null,  // Will be updated on each login
        clubIds: [],
      };

      await createUser(userCredential.user.uid, userData);

      return {
        ok: true,
        message: 'Registration successful! Please check your email to verify your account.',
      };
    } catch (error) {
      console.error('Registration error:', error);
      let message = 'Registration failed';
      if (error.code === 'auth/email-already-in-use') {
        message = 'Email already in use';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters';
      }
      return { ok: false, message };
    }
  };

  // Login user
  const login = async (email, password) => {
    console.log('🔐 LOGIN ATTEMPT STARTED');
    console.log('📧 Email:', email);
    
    try {
      console.log('1️⃣ Calling signInWithEmailAndPassword...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase auth successful, UID:', userCredential.user.uid);
      
      console.log('2️⃣ Checking email verification...');
      if (!userCredential.user.emailVerified) {
        console.error('❌ Email not verified!');
        await signOut(auth); // Sign them out immediately
        throw new Error('EMAIL_NOT_VERIFIED');
      }
      console.log('✅ Email verified');
      
      console.log('3️⃣ Fetching user document from Firestore...');
      const userDoc = await getUser(userCredential.user.uid);
      console.log('📄 User doc received:', userDoc ? 'YES' : 'NO');
      
      if (!userDoc) {
        console.error('❌ No user document found in Firestore!');
        throw new Error('User data not found');
      }

      // Track login timestamps
      const now = new Date().toISOString();
      const loginUpdates = {
        lastLoginAt: now
      };
      try {
        await setUserCustomClaims(userCredential.user.uid, userDoc.role, userDoc.isSuperAdmin);
        // FORCE TOKEN REFRESH - This is critical!
        await userCredential.user.getIdToken(true);
        console.log('✅ Custom claims set and token refreshed');
      } catch (err) {
        console.error('Failed to set custom claims:', err);
      }
    


      // Set firstLoginAt if this is the first login
      if (!userDoc.firstLoginAt) {
        loginUpdates.firstLoginAt = now;
        console.log('🎉 First login detected! Setting firstLoginAt');
      }
      
      // Update user document with login timestamps
      console.log('3️⃣ Updating login timestamps...');
      await updateUser(userCredential.user.uid, loginUpdates);

      const userData = { 
        ...userDoc,
        ...loginUpdates, // Include updated timestamps
        id: userCredential.user.uid,
        uid: userCredential.user.uid,
        emailVerified: userCredential.user.emailVerified 
      };
      
      console.log('4️⃣ Setting user state...');
      setUser(userData);
      
      console.log('5️⃣ Saving to localStorage...');
      localStorage.setItem('currentUser', JSON.stringify(userData));
      
      console.log('6️⃣ Verifying localStorage save...');
      const savedUser = localStorage.getItem('currentUser');
      console.log('✅ localStorage verification:', savedUser ? 'SAVED' : 'FAILED');
      
      if (!savedUser) {
        console.error('❌ CRITICAL: localStorage.setItem failed!');
      } else {
        console.log('✅ User logged in successfully:', userData.email);
        console.log('⏰ Last login:', userData.lastLoginAt);
      }

      return { ok: true, user: userData };
    } catch (error) {
      console.error('❌ Login error:', error);
      let message = 'Login failed';
      
      if (error.message === 'EMAIL_NOT_VERIFIED') {
        message = 'Please verify your email before logging in. Check your inbox for the verification link.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = 'Invalid email or password';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Try again later.';
      }
      return { ok: false, message };
    }
  };

  // Logout user
  const logout = async () => {
    try {
      console.log('🚪 Logout initiated...');
      
      // DO NOT remove FCM tokens on logout for web apps
      // The same device/browser will reuse the same token anyway
      // Tokens should only be removed when user explicitly disables notifications
      // or when FCM marks them as invalid
      
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('currentUser');
      console.log('✅ User logged out successfully');
      console.log('ℹ️ FCM tokens preserved (web app - same device reuses token)');
      return { ok: true };
    } catch (error) {
      console.error('❌ Logout error:', error);
      return { ok: false, message: 'Logout failed' };
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    console.log('🎧 Auth state listener initialized');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('🔥 Firebase user detected:', firebaseUser.email);
        console.log('🔥 UID:', firebaseUser.uid);
        
        try {
          const userDoc = await getUser(firebaseUser.uid);
          
          if (userDoc) {
            const userData = { 
              ...userDoc, 
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              emailVerified: firebaseUser.emailVerified 
            };
            
            console.log('📦 Setting user in state...');
            setUser(userData);
            
            console.log('💾 Saving to localStorage...');
            localStorage.setItem('currentUser', JSON.stringify(userData));
            
            console.log('✅ User data loaded and saved');
            console.log('🔍 Verify:', localStorage.getItem('currentUser') ? 'EXISTS' : 'MISSING');
          } else {
            console.warn('⚠️ Firebase user exists but no Firestore document');
            setUser(null);
            localStorage.removeItem('currentUser');
          }
        } catch (error) {
          console.error('❌ Error loading user data:', error);
          setUser(null);
          localStorage.removeItem('currentUser');
        }
      } else {
        console.log('❌ No Firebase user - logged out');
        setUser(null);
        localStorage.removeItem('currentUser');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update user profile
  const updateUserProfile = async (userId, updates) => {
    try {
      await updateUser(userId, updates);
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      console.log('✅ User profile updated');
      return { ok: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { ok: false, message: 'Failed to update profile' };
    }
  };

  // Change password
  const changePassword = async (newPassword) => {
    try {
      if (!auth.currentUser) {
        throw new Error('No user logged in');
      }
      await updatePassword(auth.currentUser, newPassword);
      return { ok: true, message: 'Password updated successfully' };
    } catch (error) {
      console.error('Change password error:', error);
      let message = 'Failed to change password';
      if (error.code === 'auth/requires-recent-login') {
        message = 'Please log out and log in again before changing your password';
      }
      return { ok: false, message };
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { ok: true, message: 'Password reset email sent' };
    } catch (error) {
      console.error('Reset password error:', error);
      return { ok: false, message: 'Failed to send reset email' };
    }
  };

  // Delete account
  const deleteAccount = async () => {
    try {
      if (!auth.currentUser) {
        throw new Error('No user logged in');
      }
      const userId = auth.currentUser.uid;
      
      await deleteUserFromFirestore(userId);
      await auth.currentUser.delete();
      
      setUser(null);
      localStorage.removeItem('currentUser');
      console.log('✅ Account deleted');
      return { ok: true };
    } catch (error) {
      console.error('Delete account error:', error);
      let message = 'Failed to delete account';
      if (error.code === 'auth/requires-recent-login') {
        message = 'Please log out and log in again before deleting your account';
      }
      return { ok: false, message };
    }
  };

  // Resend verification email
  const resendVerificationEmail = async (email = null, password = null) => {
    try {
      let userToVerify = auth.currentUser;
      let needsSignOut = false;
      
      // If email and password provided, sign in temporarily to send verification
      if (email && password && !auth.currentUser) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        userToVerify = userCredential.user;
        needsSignOut = true;
      }
      
      if (!userToVerify) {
        throw new Error('No user to send verification to');
      }
      
      await sendEmailVerification(userToVerify, {
        url: 'https://nexus-app-c69da.web.app/email-verified',
        handleCodeInApp: false
      });
      
      // Sign out if we signed in temporarily
      if (needsSignOut) {
        await signOut(auth);
      }
      
      return { ok: true, message: 'Verification email sent! Please check your inbox.' };
    } catch (error) {
      console.error('Resend verification error:', error);
      return { ok: false, message: 'Failed to send verification email. Please try again.' };
    }
  };

  const value = {
    user,
    loading,
    register,
    login,
    logout,
    updateUserProfile,
    changePassword,
    resetPassword,
    deleteAccount,
    resendVerificationEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

