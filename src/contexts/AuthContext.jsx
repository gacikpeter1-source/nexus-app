// src/contexts/AuthContext.jsx - FIREBASE VERSION
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
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
    const superAdminEmail = 'admin@nexus.com';
    const superAdminPassword = 'SuperAdmin2025!';
    
    // Check if SuperAdmin already exists
    const existing = await getUserByEmail(superAdminEmail);
    
    if (!existing) {
      console.log('🔧 Creating SuperAdmin...');
      
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        superAdminEmail,
        superAdminPassword
      );
      
      // Create Firestore user document
      await createUser(userCredential.user.uid, {
        email: superAdminEmail,
        username: 'SuperAdmin',
        role: ROLES.ADMIN,
        emailVerified: true,
        clubIds: [],
        isSuperAdmin: true
      });
      
      console.log('✅ SuperAdmin initialized');
    }
  } catch (error) {
    // SuperAdmin might already exist from a previous session
    if (error.code === 'auth/email-already-in-use') {
      console.log('✅ SuperAdmin already exists');
    } else {
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

  // Initialize SuperAdmin on app load
  useEffect(() => {
    initializeSuperAdmin();
  }, []);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, get their data from Firestore
        try {
          const userData = await getUser(firebaseUser.uid);
          if (userData) {
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email,
              ...userData
            });
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      } else {
        // User is signed out
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
      try {
        const userData = await getUser(auth.currentUser.uid);
        if (userData) {
          setUser({
            id: auth.currentUser.uid,
            email: auth.currentUser.email,
            ...userData
          });
        }
      } catch (error) {
        console.error('Error refreshing user:', error);
      }
    }
  }, []);

  /* -----------------------------
     Registration & Login
     -----------------------------*/
  const register = async (email, username, password) => {
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create Firestore user document
      await createUser(userCredential.user.uid, {
        email: email.toLowerCase(),
        username: username,
        role: ROLES.USER,
        emailVerified: true, // Skip email verification for now
        clubIds: []
      });

      // Get the created user data
      const userData = await getUser(userCredential.user.uid);
      
      setUser({
        id: userCredential.user.uid,
        email: userCredential.user.email,
        ...userData
      });

      return { user: userData };
    } catch (error) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Email already registered');
      }
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.toLowerCase(),
        password
      );

      // Get user data from Firestore
      const userData = await getUser(userCredential.user.uid);
      
      if (!userData) {
        throw new Error('User data not found');
      }

      setUser({
        id: userCredential.user.uid,
        email: userCredential.user.email,
        ...userData
      });

      return { user: userData };
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        throw new Error('Invalid email or password');
      }
      throw error;
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
     Club Management
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

      // Update user's clubIds and role
      const updatedClubIds = Array.from(new Set([...(user.clubIds || []), club.id]));
      await updateUser(user.id, {
        clubIds: updatedClubIds,
        role: ROLES.TRAINER
      });

      // Refresh user data
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

      // Update user's clubIds
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

      // Update target user's role if they're just a user
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
      
      // Remove from assistants if present
      const assistants = (club.assistants || []).filter(id => id !== targetUserId);
      
      await updateClub(clubId, { 
        trainers: updatedTrainers,
        assistants: assistants
      });

      // Update target user's role
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

      // Update user's clubIds
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

      // Update request status
      await updateRequest(requestId, {
        status: 'approved',
        handledBy: handledByUserId
      });

      // Add user to club members
      const club = await getClub(request.clubId);
      if (club) {
        const members = Array.isArray(club.members) ? club.members : [];
        if (!members.includes(request.userId)) {
          const updatedMembers = [...members, request.userId];
          
          let updates = { members: updatedMembers };

          // Add to team if specified
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

        // Update user's clubIds
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
      // Don't allow changing own admin role
      if (userId === user?.id && updates.role && updates.role !== ROLES.ADMIN) {
        throw new Error('Cannot change your own admin role');
      }

      // Don't allow changing SuperAdmin
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
      // Don't allow deleting yourself
      if (userId === user?.id) {
        throw new Error('Cannot delete your own account');
      }

      // Don't allow deleting SuperAdmin
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
    // Note: Firebase Auth doesn't allow admins to change passwords directly
    // This would require sending a password reset email
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
