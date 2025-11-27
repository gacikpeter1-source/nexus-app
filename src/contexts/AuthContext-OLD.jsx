// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import bcrypt from 'bcryptjs';

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
   Password Hashing Utilities
   -----------------------------*/
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/* -----------------------------
   Initialize SuperAdmin
   -----------------------------*/
const initializeSuperAdmin = async () => {
  const users = _getUsers();
  const superAdminEmail = 'admin@nexus.com';
  
  // Check if SuperAdmin already exists
  const existingSuperAdmin = users.find(u => u.email === superAdminEmail && u.role === ROLES.ADMIN);
  
  if (!existingSuperAdmin) {
    // Create SuperAdmin with hashed password
    const hashedPassword = await hashPassword('SuperAdmin2025!');
    
    const superAdmin = {
      id: 'superadmin-0001',
      email: superAdminEmail,
      username: 'SuperAdmin',
      password: hashedPassword, // Hashed password
      role: ROLES.ADMIN,
      emailVerified: true,
      clubIds: [],
      createdAt: new Date().toISOString(),
      isSuperAdmin: true // Special flag
    };
    
    users.push(superAdmin);
    _setUsers(users);
    console.log('✅ SuperAdmin initialized with secure password');
  }
};

/* -----------------------------
   Helpers for localStorage demo
   -----------------------------*/
const _getUsers = () => JSON.parse(localStorage.getItem('users') || '[]');
const _setUsers = (arr) => localStorage.setItem('users', JSON.stringify(arr));

const _getClubs = () => JSON.parse(localStorage.getItem('clubs') || '[]');
const _setClubs = (arr) => localStorage.setItem('clubs', JSON.stringify(arr));

const _getRequests = () => JSON.parse(localStorage.getItem('joinRequests') || '[]');
const _setRequests = (arr) => localStorage.setItem('joinRequests', JSON.stringify(arr));

const _generateId = (prefix = '') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;

function generateUniqueClubCode() {
  const clubs = _getClubs();
  for (let tries = 0; tries < 200; tries++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!clubs.some(c => c.clubCode === code)) return code;
  }
  return Math.random().toString(36).slice(2,8);
}

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

  // refresh user from localStorage currentUser
  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const cu = localStorage.getItem('currentUser');
      if (cu) {
        const parsed = JSON.parse(cu);
        // ensure clubIds exists and is array (migration from clubId)
        if (!parsed.clubIds) parsed.clubIds = parsed.clubId ? [parsed.clubId] : [];
        setUser(parsed);
        return parsed;
      } else {
        setUser(null);
        return null;
      }
    } catch (err) {
      console.error('refreshUser error', err);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  /* -----------------------------
     Registration with Password Hashing
     -----------------------------*/
  const register = async (email) => {
    await new Promise(r => setTimeout(r, 300)); // simulate
    const users = _getUsers();
    if (users.some(u => u.email === email)) throw new Error('Email already registered');

    const newUser = {
      id: _generateId('u_'),
      email,
      emailVerified: true, // for local dev we mark verified by default; change in prod
      role: ROLES.USER,
      username: null,
      clubIds: [] // multi-club membership
    };
    users.push(newUser);
    _setUsers(users);

    // keep token flow for demo pages (completeRegistration)
    const token = Math.random().toString(36).slice(2, 12);
    localStorage.setItem(`verificationToken_${token}`, JSON.stringify({
      userId: newUser.id,
      email: newUser.email,
      expires: Date.now() + 24 * 60 * 60 * 1000
    }));
    return { token };
  };

  const completeRegistration = async (token, username, password) => {
    await new Promise(r => setTimeout(r, 300));
    const tokenData = localStorage.getItem(`verificationToken_${token}`);
    if (!tokenData) throw new Error('Invalid or expired token');
    const { userId } = JSON.parse(tokenData);
    const users = _getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');

    if (users.some(u => u.username === username && u.id !== userId)) {
      throw new Error('Username already taken');
    }

    // Hash the password before storing
    const hashedPassword = await hashPassword(password);

    users[idx] = {
      ...users[idx],
      username,
      password: hashedPassword, // Store hashed password
      emailVerified: true,
      clubIds: users[idx].clubIds || (users[idx].clubId ? [users[idx].clubId] : [])
    };
    _setUsers(users);
    localStorage.removeItem(`verificationToken_${token}`);

    const udata = {
      id: users[idx].id,
      email: users[idx].email,
      username: users[idx].username,
      role: users[idx].role,
      clubIds: users[idx].clubIds || []
    };
    localStorage.setItem('currentUser', JSON.stringify(udata));
    setUser(udata);
    return { user: udata };
  };

  /* -----------------------------
     Login with Password Comparison
     -----------------------------*/
  const login = async (email, password) => {
    await new Promise(r => setTimeout(r, 300));

    const users = _getUsers();
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!found) {
      throw new Error('Invalid email or password');
    }

    // Compare password with hashed password
    const isPasswordValid = await comparePassword(password, found.password);
    
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    const udata = {
      id: found.id,
      email: found.email,
      username: found.username,
      role: found.role,
      clubIds: found.clubIds || (found.clubId ? [found.clubId] : []),
      isSuperAdmin: found.isSuperAdmin || false
    };
    
    localStorage.setItem('currentUser', JSON.stringify(udata));
    setUser(udata);
    return { user: udata };
  };

  const logout = () => {
    localStorage.removeItem('currentUser');
    setUser(null);
  };

  /* -----------------------------
     Create Club
     -----------------------------*/
  const createClub = async ({ name }) => {
    if (!user) throw new Error('Must be logged in to create a club');
    if (!name || name.trim().length < 2) throw new Error('Club name is required');

    const clubs = _getClubs();
    const clubId = _generateId('c_');
    const clubCode = generateUniqueClubCode();

    const club = {
      id: clubId,
      name: name.trim(),
      clubCode,
      createdBy: user.id,
      createdAt: Date.now(),
      trainers: [user.id],
      assistants: [],
      members: [],
      teams: []
    };
    clubs.push(club);
    _setClubs(clubs);

    // add clubId to creator user's clubIds and set role to TRAINER
    const users = _getUsers();
    const uidx = users.findIndex(u => u.id === user.id);
    if (uidx !== -1) {
      const existingClubIds = users[uidx].clubIds || (users[uidx].clubId ? [users[uidx].clubId] : []);
      const nextClubIds = Array.from(new Set([...(existingClubIds || []), clubId]));
      users[uidx] = { ...users[uidx], role: ROLES.TRAINER, clubIds: nextClubIds };
      _setUsers(users);

      const updatedUser = { ...user, role: ROLES.TRAINER, clubIds: nextClubIds };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }

    return { club };
  };

  // [REST OF THE FUNCTIONS REMAIN THE SAME - createTeam, getClubByCode, etc.]
  // I'll include the key ones below, but the file is getting long

  const createTeam = async ({ clubId, name, sport }) => {
    if (!user) throw new Error('Must be logged in');
    const clubs = _getClubs();
    const idx = clubs.findIndex(c => c.id === clubId);
    if (idx === -1) throw new Error('Club not found');

    const club = clubs[idx];
    const isTrainerOrAssistantOrAdmin = 
      club.trainers?.includes(user.id) || 
      club.assistants?.includes(user.id) ||
      user.role === ROLES.ADMIN;

    if (!isTrainerOrAssistantOrAdmin) throw new Error('Unauthorized');

    const teamId = _generateId('t_');
    const newTeam = {
      id: teamId,
      name: name.trim(),
      sport: sport || '',
      createdBy: user.id,
      createdAt: Date.now(),
      members: [],
      events: []
    };

    club.teams = club.teams || [];
    club.teams.push(newTeam);
    clubs[idx] = club;
    _setClubs(clubs);

    return { team: newTeam };
  };

  const getClubByCode = async (code) => {
    const clubs = _getClubs();
    const found = clubs.find(c => c.clubCode === code);
    if (!found) throw new Error('Club not found');
    return found;
  };

  const getClubById = async (clubId) => {
    const clubs = _getClubs();
    const found = clubs.find(c => c.id === clubId);
    if (!found) throw new Error('Club not found');
    return found;
  };

  const joinClubByCode = async ({ code }) => {
    if (!user) throw new Error('Must be logged in');
    const club = await getClubByCode(code);
    
    club.members = Array.isArray(club.members) ? club.members : [];
    if (club.members.includes(user.id)) {
      throw new Error('Already a member');
    }

    club.members.push(user.id);
    const clubs = _getClubs();
    const idx = clubs.findIndex(c => c.id === club.id);
    if (idx !== -1) {
      clubs[idx] = club;
      _setClubs(clubs);
    }

    const users = _getUsers();
    const uidx = users.findIndex(u => u.id === user.id);
    if (uidx !== -1) {
      const existingClubIds = users[uidx].clubIds || (users[uidx].clubId ? [users[uidx].clubId] : []);
      const nextClubIds = Array.from(new Set([...(existingClubIds || []), club.id]));
      users[uidx] = { ...users[uidx], clubIds: nextClubIds };
      _setUsers(users);

      const updatedUser = { ...user, clubIds: nextClubIds };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }

    return { club };
  };

  const nominateAssistant = async ({ clubId, targetUserId }) => {
    if (!user) throw new Error('Must be logged in');
    const clubs = _getClubs();
    const idx = clubs.findIndex(c => c.id === clubId);
    if (idx === -1) throw new Error('Club not found');

    const club = clubs[idx];
    const isTrainerOrAdmin = club.trainers?.includes(user.id) || user.role === ROLES.ADMIN;
    if (!isTrainerOrAdmin) throw new Error('Only trainers/admins can nominate assistants');

    club.assistants = Array.isArray(club.assistants) ? club.assistants : [];
    if (club.assistants.includes(targetUserId)) {
      throw new Error('Already an assistant');
    }
    club.assistants.push(targetUserId);
    clubs[idx] = club;
    _setClubs(clubs);

    const users = _getUsers();
    const uidx = users.findIndex(u => u.id === targetUserId);
    if (uidx !== -1) {
      if (users[uidx].role === ROLES.USER) {
        users[uidx] = { ...users[uidx], role: ROLES.ASSISTANT };
        _setUsers(users);
      }
    }

    return { success: true };
  };

  const nominateTrainer = async ({ clubId, targetUserId }) => {
    if (!user) throw new Error('Must be logged in');
    const clubs = _getClubs();
    const idx = clubs.findIndex(c => c.id === clubId);
    if (idx === -1) throw new Error('Club not found');

    const club = clubs[idx];
    const isTrainerOrAdmin = club.trainers?.includes(user.id) || user.role === ROLES.ADMIN;
    if (!isTrainerOrAdmin) throw new Error('Only trainers/admins can nominate trainers');

    club.trainers = Array.isArray(club.trainers) ? club.trainers : [];
    if (club.trainers.includes(targetUserId)) {
      throw new Error('Already a trainer');
    }
    club.trainers.push(targetUserId);

    club.assistants = (club.assistants || []).filter(id => id !== targetUserId);

    clubs[idx] = club;
    _setClubs(clubs);

    const users = _getUsers();
    const uidx = users.findIndex(u => u.id === targetUserId);
    if (uidx !== -1) {
      users[uidx] = { ...users[uidx], role: ROLES.TRAINER };
      _setUsers(users);
    }

    return { success: true };
  };

  const listClubsForUser = () => {
    if (!user) return [];
    const clubs = _getClubs();
    return clubs.filter(c => {
      const userClubIds = user.clubIds || (user.clubId ? [user.clubId] : []);
      return userClubIds.includes(c.id) ||
             c.trainers?.includes(user.id) ||
             c.assistants?.includes(user.id) ||
             c.members?.includes(user.id);
    });
  };

  const requestJoin = async ({ userId, clubId, teamId = null }) => {
    const clubs = _getClubs();
    const club = clubs.find(c => c.id === clubId);
    if (!club) throw new Error('Club not found');

    const requests = _getRequests();
    const existing = requests.find(r =>
      r.userId === userId &&
      r.clubId === clubId &&
      r.teamId === teamId &&
      r.status === 'pending'
    );
    if (existing) throw new Error('Request already pending');

    const req = {
      id: _generateId('req_'),
      userId,
      clubId,
      teamId: teamId || null,
      clubName: club.name,
      teamName: teamId ? ((club.teams || []).find(t => t.id === teamId)?.name || null) : null,
      createdAt: Date.now(),
      status: 'pending'
    };

    requests.push(req);
    _setRequests(requests);
    return { ok: true, request: req };
  };

  const requestJoinTeam = async ({ clubId, teamId }) => {
    if (!user) throw new Error('Must be logged in to request team join');
    if (!clubId || !teamId) throw new Error('clubId and teamId required');
    return requestJoin({ userId: user.id, clubId, teamId });
  };

  const approveJoinRequest = async ({ requestId, handledByUserId = null }) => {
    const requests = _getRequests();
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Request not found');
    const req = requests[idx];
    req.status = 'approved';
    req.handledAt = Date.now();
    req.handledBy = handledByUserId;
    requests[idx] = req;
    _setRequests(requests);

    const clubs = _getClubs();
    const cidx = clubs.findIndex(c => c.id === req.clubId);
    if (cidx !== -1) {
      const club = clubs[cidx];
      club.members = Array.isArray(club.members) ? club.members : [];
      if (!club.members.includes(req.userId)) club.members.push(req.userId);

      if (req.teamId) {
        club.teams = club.teams || [];
        const tidx = club.teams.findIndex(t => t.id === req.teamId);
        if (tidx !== -1) {
          const team = club.teams[tidx];
          team.members = Array.isArray(team.members) ? team.members : [];
          if (!team.members.includes(req.userId)) team.members.push(req.userId);
          club.teams[tidx] = team;
        }
      }

      clubs[cidx] = club;
      _setClubs(clubs);
    }

    const users = _getUsers();
    const uidx = users.findIndex(u => u.id === req.userId);
    if (uidx !== -1) {
      const existingClubIds = users[uidx].clubIds || (users[uidx].clubId ? [users[uidx].clubId] : []);
      const nextClubIds = Array.from(new Set([...(existingClubIds || []), req.clubId]));
      users[uidx] = { ...users[uidx], clubIds: nextClubIds };
      _setUsers(users);

      const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (cu && cu.id === req.userId) {
        localStorage.setItem('currentUser', JSON.stringify({ ...cu, clubIds: nextClubIds }));
      }
    }

    return { ok: true, request: req };
  };

  const denyJoinRequest = async ({ requestId, handledByUserId = null }) => {
    const requests = _getRequests();
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Request not found');
    requests[idx].status = 'denied';
    requests[idx].handledAt = Date.now();
    requests[idx].handledBy = handledByUserId;
    _setRequests(requests);
    return { ok: true, request: requests[idx] };
  };

  const leaveClub = async ({ clubId }) => {
    if (!user) throw new Error('Must be logged in');
    const clubs = _getClubs();
    const idx = clubs.findIndex(c => c.id === clubId);
    if (idx === -1) throw new Error('Club not found');

    const club = clubs[idx];
    club.trainers = (club.trainers || []).filter(id => id !== user.id);
    club.assistants = (club.assistants || []).filter(id => id !== user.id);
    club.members = (club.members || []).filter(id => id !== user.id);
    clubs[idx] = club;
    _setClubs(clubs);

    const users = _getUsers();
    const uidx = users.findIndex(u => u.id === user.id);
    if (uidx !== -1) {
      const currentClubIds = users[uidx].clubIds || (users[uidx].clubId ? [users[uidx].clubId] : []);
      const nextClubIds = currentClubIds.filter(id => id !== clubId);
      const newRole = users[uidx].role === ROLES.TRAINER ? ROLES.USER : users[uidx].role;
      users[uidx] = { ...users[uidx], role: newRole, clubIds: nextClubIds };
      _setUsers(users);

      const updatedUser = { ...user, clubIds: nextClubIds, role: newRole };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }

    return { success: true };
  };

  /* -----------------------------
     Role helpers
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

  const listUsers = () => {
    if (!isAdmin()) {
      console.warn('listUsers: user is not admin');
      return [];
    }
    const allUsers = _getUsers();
    console.log('listUsers returned:', allUsers);
    return allUsers;
  };

  const updateUser = async ({ userId, updates }) => {
    if (!isAdmin()) throw new Error('Only admins can update users');
    
    const users = _getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    
    // Don't allow changing own admin role
    if (userId === user?.id && updates.role && updates.role !== ROLES.ADMIN) {
      throw new Error('Cannot change your own admin role');
    }
    
    // Don't allow changing SuperAdmin
    if (users[idx].isSuperAdmin && userId !== user?.id) {
      throw new Error('Cannot modify SuperAdmin account');
    }
    
    users[idx] = { ...users[idx], ...updates };
    _setUsers(users);
    
    return { success: true, user: users[idx] };
  };

  const deleteUser = async ({ userId }) => {
    if (!isAdmin()) throw new Error('Only admins can delete users');
    
    const users = _getUsers();
    const targetUser = users.find(u => u.id === userId);
    
    // Don't allow deleting yourself
    if (userId === user?.id) {
      throw new Error('Cannot delete your own account');
    }
    
    // Don't allow deleting SuperAdmin
    if (targetUser?.isSuperAdmin) {
      throw new Error('Cannot delete SuperAdmin account');
    }
    
    const filtered = users.filter(u => u.id !== userId);
    _setUsers(filtered);
    
    return { success: true };
  };

  const changeUserPassword = async ({ userId, newPassword }) => {
    if (!isAdmin()) throw new Error('Only admins can change passwords');
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    
    const users = _getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    users[idx] = { ...users[idx], password: hashedPassword };
    _setUsers(users);
    
    return { success: true };
  };

  /* -----------------------------
     Exported API
     -----------------------------*/
  const value = {
    user,
    loading,
    refreshUser,
    register,
    completeRegistration,
    login,
    logout,
    createClub,
    createTeam,
    getClubByCode,
    getClubById,
    joinClubByCode,
    nominateAssistant,
    nominateTrainer,
    listClubsForUser,
    leaveClub,
    requestJoin,
    requestJoinTeam,
    approveJoinRequest,
    denyJoinRequest,
    hasRole,
    hasAnyRole,
    canManageEvents,
    canManageTeam,
    isAdmin,
    listUsers,
    updateUser,
    deleteUser,
    changeUserPassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
