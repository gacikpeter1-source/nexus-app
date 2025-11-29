// src/contexts/AuthContext.jsx - WITH EMAIL VERIFICATION
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  getAllUsers,
  deleteUser as deleteUserFromFirestore,
  createClub,
  getClub,
  getClubByCode,
  updateClub,
  getAllClubs,
  getUserClubs,
  deleteClub as deleteClubFromFirestore,
  createRequest,
  getRequest,
  updateRequest,
  getPendingRequests,
  generateUniqueCode
} from '../firebase/firestore';

const AuthContext = createContext(null);

export const ROLES = {
  ADMIN: 'admin',
  TRAINER: 'trainer',
  ASSISTANT: 'assistant',
  USER: 'user',
  PARENT: 'parent'
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/* -----------------------------
   Initialize SuperAdmin
   -----------------------------*/
const initializeSuperAdmin = async () => {
  try {
    const superAdminEmail = import.meta.env.VITE_ADMIN_EMAIL;
    const superAdminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
    
    const existing = await getUserByEmail(superAdminEmail);
    
    if (!existing) {
      
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        superAdminEmail,
        superAdminPassword
      );
      
      // SuperAdmin doesn't need email verification
      await createUser(userCredential.user.uid, {
        email: superAdminEmail,
        username: 'SuperAdmin',
        role: ROLES.ADMIN,
        emailVerified: true, // Auto-verified
        clubIds: [],
        isSuperAdmin: true
      });
      
    }
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.error('Error initializing SuperAdmin:', error);
    }
  }
};

/* -----------------------------
   Auth Provider
   -----------------------------*/
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeSuperAdmin();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userData = await getUser(firebaseUser.uid);
          if (userData) {
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email,
              emailVerified: firebaseUser.emailVerified, // FROM FIREBASE AUTH
              ...userData
            });
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
      try {
        // Reload Firebase user to get latest emailVerified status
        await auth.currentUser.reload();
        
        const userData = await getUser(auth.currentUser.uid);
        if (userData) {
          setUser({
            id: auth.currentUser.uid,
            email: auth.currentUser.email,
            emailVerified: auth.currentUser.emailVerified,
            ...userData
          });
        }
      } catch (error) {
        console.error('Error refreshing user:', error);
      }
    }
  }, []);

  /* -----------------------------
     Registration with Email Verification
     -----------------------------*/
  const register = async (email, username, password) => {
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send verification email
      await sendEmailVerification(userCredential.user);
      
      // Create Firestore user document
      await createUser(userCredential.user.uid, {
        email: email.toLowerCase(),
        username,
        role: ROLES.USER,
        emailVerified: false, // Will be true after verification
        clubIds: []
      });

      // Sign out immediately - user must verify first
      await signOut(auth);
      
      return { 
        success: true,
        message: 'Registration successful! Please check your email to verify your account.'
      };
    } catch (error) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Email already registered');
      }
      throw error;
    }
  };

  /* -----------------------------
     Login with Email Verification Check
     -----------------------------*/
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.toLowerCase(),
        password
      );

      // Check if email is verified (except for SuperAdmin)
      const userData = await getUser(userCredential.user.uid);
      
      if (!userData) {
        throw new Error('User data not found');
      }

      // Allow SuperAdmin to login without verification
      if (!userData.isSuperAdmin && !userCredential.user.emailVerified) {
        // Sign out immediately
        await signOut(auth);
        throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
      }

      setUser({
        id: userCredential.user.uid,
        email: userCredential.user.email,
        emailVerified: userCredential.user.emailVerified,
        ...userData
      });

      return { user: userData };
    } catch (error) {
      console.error('Login error:', error);
      if (error.message.includes('verify your email')) {
        throw error; // Pass through our custom message
      }
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password');
      }
      throw error;
    }
  };

  /* -----------------------------
     Resend Verification Email
     -----------------------------*/
  const resendVerificationEmail = async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      try {
        await sendEmailVerification(auth.currentUser);
        return { success: true, message: 'Verification email sent! Please check your inbox.' };
      } catch (error) {
        console.error('Error sending verification email:', error);
        if (error.code === 'auth/too-many-requests') {
          throw new Error('Too many requests. Please wait a few minutes before trying again.');
        }
        throw error;
      }
    } else {
      throw new Error('No user signed in or email already verified');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  /* -----------------------------
     Club Management (same as before)
     -----------------------------*/
  const createClubFn = async ({ name }) => {
    if (!user) throw new Error('Must be logged in to create a club');
    if (!name || name.trim().length < 2) throw new Error('Club name is required');

    try {
      const clubCode = await generateUniqueCode();
      
      const clubData = {
        name: name.trim(),
        clubCode,
        createdBy: user.id,
        trainers: [user.id],
        assistants: [],
        members: [],
        teams: []
      };

      const club = await createClub(clubData);

      const updatedClubIds = Array.from(new Set([...(user.clubIds || []), club.id]));
      await updateUser(user.id, {
        clubIds: updatedClubIds,
        role: ROLES.TRAINER
      });

      await refreshUser();

      return { club };
    } catch (error) {
      console.error('Error creating club:', error);
      throw error;
    }
  };

  const createTeam = async ({ clubId, name, sport }) => {
    if (!user) throw new Error('Must be logged in');
    
    try {
      const club = await getClub(clubId);
      if (!club) throw new Error('Club not found');

      const isAuthorized =
        club.trainers?.includes(user.id) ||
        club.assistants?.includes(user.id) ||
        user.role === ROLES.ADMIN;

      if (!isAuthorized) throw new Error('Unauthorized');

      const teamId = `team_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
      const newTeam = {
        id: teamId,
        name: name.trim(),
        sport: sport || '',
        createdBy: user.id,
        members: [],
        events: []
      };

      const updatedTeams = [...(club.teams || []), newTeam];
      await updateClub(clubId, { teams: updatedTeams });

      return { team: newTeam };
    } catch (error) {
      console.error('Error creating team:', error);
      throw error;
    }
  };

  const getClubByCodeFn = async (code) => {
    try {
      const club = await getClubByCode(code);
      if (!club) throw new Error('Club not found');
      return club;
    } catch (error) {
      console.error('Error getting club by code:', error);
      throw error;
    }
  };

  const getClubByIdFn = async (clubId) => {
    try {
      const club = await getClub(clubId);
      if (!club) throw new Error('Club not found');
      return club;
    } catch (error) {
      console.error('Error getting club by ID:', error);
      throw error;
    }
  };

  const joinClubByCode = async ({ code }) => {
    if (!user) throw new Error('Must be logged in');
    
    try {
      const club = await getClubByCode(code);
      if (!club) throw new Error('Club not found');

      const members = Array.isArray(club.members) ? club.members : [];
      if (members.includes(user.id)) {
        throw new Error('Already a member');
      }

      const updatedMembers = [...members, user.id];
      await updateClub(club.id, { members: updatedMembers });

      const updatedClubIds = Array.from(new Set([...(user.clubIds || []), club.id]));
      await updateUser(user.id, { clubIds: updatedClubIds });

      await refreshUser();

      return { club };
    } catch (error) {
      console.error('Error joining club:', error);
      throw error;
    }
  };

  const nominateAssistant = async ({ clubId, targetUserId }) => {
    if (!user) throw new Error('Must be logged in');
    
    try {
      const club = await getClub(clubId);
      if (!club) throw new Error('Club not found');

      const isAuthorized = club.trainers?.includes(user.id) || user.role === ROLES.ADMIN;
      if (!isAuthorized) throw new Error('Only trainers/admins can nominate assistants');

      const assistants = Array.isArray(club.assistants) ? club.assistants : [];
      if (assistants.includes(targetUserId)) {
        throw new Error('Already an assistant');
      }

      const updatedAssistants = [...assistants, targetUserId];
      await updateClub(clubId, { assistants: updatedAssistants });

      const targetUser = await getUser(targetUserId);
      if (targetUser && targetUser.role === ROLES.USER) {
        await updateUser(targetUserId, { role: ROLES.ASSISTANT });
      }

      return { success: true };
    } catch (error) {
      console.error('Error nominating assistant:', error);
      throw error;
    }
  };

  const nominateTrainer = async ({ clubId, targetUserId }) => {
    if (!user) throw new Error('Must be logged in');
    
    try {
      const club = await getClub(clubId);
      if (!club) throw new Error('Club not found');

      const isAuthorized = club.trainers?.includes(user.id) || user.role === ROLES.ADMIN;
      if (!isAuthorized) throw new Error('Only trainers/admins can nominate trainers');

      const trainers = Array.isArray(club.trainers) ? club.trainers : [];
      if (trainers.includes(targetUserId)) {
        throw new Error('Already a trainer');
      }

      const updatedTrainers = [...trainers, targetUserId];
      const assistants = (club.assistants || []).filter(id => id !== targetUserId);
      
      await updateClub(clubId, { 
        trainers: updatedTrainers,
        assistants
      });

      await updateUser(targetUserId, { role: ROLES.TRAINER });

      return { success: true };
    } catch (error) {
      console.error('Error nominating trainer:', error);
      throw error;
    }
  };

  const listClubsForUser = async () => {
    if (!user) return [];
    
    try {
      return await getUserClubs(user.id);
    } catch (error) {
      console.error('Error listing clubs:', error);
      return [];
    }
  };

  const leaveClub = async ({ clubId }) => {
    if (!user) throw new Error('Must be logged in');
    
    try {
      const club = await getClub(clubId);
      if (!club) throw new Error('Club not found');

      const updatedClub = {
        trainers: (club.trainers || []).filter(id => id !== user.id),
        assistants: (club.assistants || []).filter(id => id !== user.id),
        members: (club.members || []).filter(id => id !== user.id)
      };

      await updateClub(clubId, updatedClub);

      const updatedClubIds = (user.clubIds || []).filter(id => id !== clubId);
      const newRole = user.role === ROLES.TRAINER ? ROLES.USER : user.role;
      
      await updateUser(user.id, {
        clubIds: updatedClubIds,
        role: newRole
      });

      await refreshUser();

      return { success: true };
    } catch (error) {
      console.error('Error leaving club:', error);
      throw error;
    }
  };

  /* -----------------------------
     Join Requests
     -----------------------------*/
  const requestJoin = async ({ userId, clubId, teamId = null }) => {
    try {
      const club = await getClub(clubId);
      if (!club) throw new Error('Club not found');

      const requestData = {
        userId,
        clubId,
        teamId: teamId || null,
        clubName: club.name,
        teamName: teamId ? ((club.teams || []).find(t => t.id === teamId)?.name || null) : null
      };

      const request = await createRequest(requestData);
      return { ok: true, request };
    } catch (error) {
      console.error('Error creating request:', error);
      throw error;
    }
  };

  const requestJoinTeam = async ({ clubId, teamId }) => {
    if (!user) throw new Error('Must be logged in to request team join');
    if (!clubId || !teamId) throw new Error('clubId and teamId required');
    return requestJoin({ userId: user.id, clubId, teamId });
  };

  const approveJoinRequest = async ({ requestId, handledByUserId = null }) => {
    try {
      const request = await getRequest(requestId);
      if (!request) throw new Error('Request not found');

      await updateRequest(requestId, {
        status: 'approved',
        handledBy: handledByUserId
      });

      const club = await getClub(request.clubId);
      if (club) {
        const members = Array.isArray(club.members) ? club.members : [];
        if (!members.includes(request.userId)) {
          const updatedMembers = [...members, request.userId];
          
          const updates = { members: updatedMembers };

          if (request.teamId) {
            const teams = club.teams || [];
            const teamIndex = teams.findIndex(t => t.id === request.teamId);
            if (teamIndex !== -1) {
              const team = teams[teamIndex];
              const teamMembers = Array.isArray(team.members) ? team.members : [];
              if (!teamMembers.includes(request.userId)) {
                teams[teamIndex] = {
                  ...team,
                  members: [...teamMembers, request.userId]
                };
                updates.teams = teams;
              }
            }
          }

          await updateClub(request.clubId, updates);
        }

        const targetUser = await getUser(request.userId);
        if (targetUser) {
          const clubIds = Array.from(new Set([...(targetUser.clubIds || []), request.clubId]));
          await updateUser(request.userId, { clubIds });
        }
      }

      return { ok: true, request };
    } catch (error) {
      console.error('Error approving request:', error);
      throw error;
    }
  };

  const denyJoinRequest = async ({ requestId, handledByUserId = null }) => {
    try {
      await updateRequest(requestId, {
        status: 'denied',
        handledBy: handledByUserId
      });

      return { ok: true };
    } catch (error) {
      console.error('Error denying request:', error);
      throw error;
    }
  };

  /* -----------------------------
     Role Helpers
     -----------------------------*/
  const hasRole = (roles) => {
    if (!user) return false;
    if (!roles) return false;
    if (Array.isArray(roles)) return roles.includes(user.role);
    return user.role === roles;
  };

  const hasAnyRole = (arr = []) => {
    if (!user) return false;
    return Array.isArray(arr) && arr.includes(user.role);
  };

  const canManageEvents = () => hasAnyRole([ROLES.ADMIN, ROLES.TRAINER, ROLES.ASSISTANT]);
  const canManageTeam = () => hasAnyRole([ROLES.ADMIN, ROLES.TRAINER, ROLES.ASSISTANT]);
  const isAdmin = () => hasRole(ROLES.ADMIN);

  const listUsers = async () => {
    if (!isAdmin()) {
      console.warn('listUsers: user is not admin');
      return [];
    }
    try {
      return await getAllUsers();
    } catch (error) {
      console.error('Error listing users:', error);
      return [];
    }
  };

  const updateUserFn = async ({ userId, updates }) => {
    if (!isAdmin()) throw new Error('Only admins can update users');
    
    try {
      if (userId === user?.id && updates.role && updates.role !== ROLES.ADMIN) {
        throw new Error('Cannot change your own admin role');
      }

      const targetUser = await getUser(userId);
      if (targetUser?.isSuperAdmin && userId !== user?.id) {
        throw new Error('Cannot modify SuperAdmin account');
      }

      await updateUser(userId, updates);
      return { success: true };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  const deleteUserFn = async ({ userId }) => {
    if (!isAdmin()) throw new Error('Only admins can delete users');
    
    try {
      if (userId === user?.id) {
        throw new Error('Cannot delete your own account');
      }

      const targetUser = await getUser(userId);
      if (targetUser?.isSuperAdmin) {
        throw new Error('Cannot delete SuperAdmin account');
      }

      await deleteUserFromFirestore(userId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  };

  const changeUserPassword = async ({ userId, newPassword }) => {
    throw new Error('Password reset requires email verification. Use Firebase Auth password reset.');
  };

  /* -----------------------------
     Exported API
     -----------------------------*/
  const value = {
    user,
    loading,
    refreshUser,
    register,
    login,
    logout,
    resendVerificationEmail, // NEW!
    // Clubs
    createClub: createClubFn,
    createTeam,
    getClubByCode: getClubByCodeFn,
    getClubById: getClubByIdFn,
    joinClubByCode,
    nominateAssistant,
    nominateTrainer,
    listClubsForUser,
    leaveClub,
    // Requests
    requestJoin,
    requestJoinTeam,
    approveJoinRequest,
    denyJoinRequest,
    // Roles
    hasRole,
    hasAnyRole,
    canManageEvents,
    canManageTeam,
    isAdmin,
    listUsers,
    updateUser: updateUserFn,
    deleteUser: deleteUserFn,
    changeUserPassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
