// src/contexts/AuthContext.jsx
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
} from '../firebase/firestore';

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
      
      await sendEmailVerification(userCredential.user, {
        url: 'https://nexus-app-tau.vercel.app/complete-registration?verified=true',
        handleCodeInApp: false
      });

      const userData = {
        email: email.toLowerCase(),
        username,
        role,
        emailVerified: false,
        createdAt: new Date().toISOString(),
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
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const userDoc = await getUser(userCredential.user.uid);
      if (!userDoc) {
        throw new Error('User data not found');
      }

      const userData = { 
        ...userDoc, 
        id: userCredential.user.uid,
        uid: userCredential.user.uid,
        emailVerified: userCredential.user.emailVerified 
      };
      
      setUser(userData);
      localStorage.setItem('currentUser', JSON.stringify(userData)); // ✅ FIXED: Save to localStorage
      console.log('✅ User logged in and saved to localStorage:', userData.email);

      return { ok: true, user: userData };
    } catch (error) {
      console.error('Login error:', error);
      let message = 'Login failed';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
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
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('currentUser');
      console.log('✅ User logged out');
      return { ok: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { ok: false, message: 'Logout failed' };
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('🔥 Firebase user detected:', firebaseUser.email);
        try {
          const userDoc = await getUser(firebaseUser.uid);
          if (userDoc) {
            const userData = { 
              ...userDoc, 
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              emailVerified: firebaseUser.emailVerified 
            };
            setUser(userData);
            localStorage.setItem('currentUser', JSON.stringify(userData)); // ✅ FIXED: Sync to localStorage
            console.log('✅ User data loaded and saved to localStorage');
          } else {
            console.warn('⚠️ Firebase user exists but no Firestore document');
            setUser(null);
            localStorage.removeItem('currentUser');
          }
        } catch (error) {
          console.error('Error loading user data:', error);
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
      localStorage.setItem('currentUser', JSON.stringify(updatedUser)); // ✅ FIXED: Update localStorage
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
  const resendVerificationEmail = async () => {
    try {
      if (!auth.currentUser) {
        throw new Error('No user logged in');
      }
      await sendEmailVerification(auth.currentUser, {
        url: 'https://nexus-app-tau.vercel.app/complete-registration?verified=true',
        handleCodeInApp: false
      });
      return { ok: true, message: 'Verification email sent' };
    } catch (error) {
      console.error('Resend verification error:', error);
      return { ok: false, message: 'Failed to send verification email' };
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
