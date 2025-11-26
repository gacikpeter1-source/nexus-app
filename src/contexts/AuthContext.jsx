// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
     Existing flows (register/login/completeRegistration)
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

    users[idx] = {
      ...users[idx],
      username,
      password, // demo only
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

  const login = async (email, password) => {
    await new Promise(r => setTimeout(r, 300));

    // ---------- HARD-CODED ADMIN LOGIN (development only) ----------
    // Allows logging in with admin@gmail.com / 2025Tomasko2025 to get an Admin user.
    // This block is intentionally minimal and early-returning so existing flows remain unchanged.
    try {
      if (String(email).toLowerCase() === 'admin@gmail.com' && String(password) === '2025Tomasko2025') {
        const adminUser = {
          id: 'admin-0001',
          email: 'admin@gmail.com',
          username: 'Administrator',
          role: ROLES.ADMIN,
          clubIds: []
        };
        localStorage.setItem('currentUser', JSON.stringify(adminUser));
        setUser(adminUser);
        return { user: adminUser };
      }
    } catch (e) {
      // ignore and fallthrough to normal login
      console.warn('admin login check error', e);
    }
    // ---------------------------------------------------------------

    const users = _getUsers();
    const found = users.find(u => u.email === email);
    if (!found) throw new Error('Invalid email or password');
    if (found.password !== password) throw new Error('Invalid email or password');

    const udata = {
      id: found.id,
      email: found.email,
      username: found.username,
      role: found.role,
      clubIds: found.clubIds || (found.clubId ? [found.clubId] : [])
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
     Club & team management & Trainer flows
     -----------------------------*/

  // Create a club. Creator becomes trainer and clubCode is generated.
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

  // create a team inside a club (only trainer/assistant/admin of that club)
// create a team inside a club (only trainer/assistant/admin of that club)
const createTeam = async ({ clubId, name, description = '' }) => {
  if (!user) throw new Error('Must be logged in to create a team');
  if (!clubId || !name) throw new Error('clubId and name required');

  const clubs = _getClubs();
  const idx = clubs.findIndex(c => c.id === clubId);
  if (idx === -1) throw new Error('Club not found');

  const club = clubs[idx];
  // permission check: user must be trainer/assistant/admin for that club or global admin
  const isClubTrainerOrAssistant = (club.trainers || []).includes(user.id) || (club.assistants || []).includes(user.id);
  if (!(isClubTrainerOrAssistant || user.role === ROLES.ADMIN)) {
    throw new Error('Only trainers/assistants/admins of this club can create teams');
  }

  const team = {
    id: _generateId('t_'),
    name: name.trim(),
    description: description || '',
    // if user is club trainer/assistant then make them a trainer;
    // also if user is global admin, add them as trainer so admin can manage the team
    trainers: (isClubTrainerOrAssistant || user.role === ROLES.ADMIN) ? [user.id] : [],
    assistants: [],
    members: [],
    createdAt: Date.now()
  };

  club.teams = Array.isArray(club.teams) ? club.teams : [];
  club.teams.push(team);
  clubs[idx] = club;
  _setClubs(clubs);

  return { team, club };
};


  // find club by its unique club code
  const getClubByCode = ({ code }) => {
    if (!code) return null;
    const clubs = _getClubs();
    return clubs.find(c => String(c.clubCode) === String(code)) || null;
  };

  const getClubById = ({ id }) => {
    if (!id) return null;
    const clubs = _getClubs();
    return clubs.find(c => c.id === id) || null;
  };

  // join a club as trainer by providing the club code (adds trainer role)
  const joinClubByCode = async ({ code }) => {
    if (!user) throw new Error('Must be logged in to join a club');
    if (!code) throw new Error('Club code is required');
    const clubs = _getClubs();
    const idx = clubs.findIndex(c => String(c.clubCode) === String(code));
    if (idx === -1) throw new Error('Invalid club code');
    const club = clubs[idx];

    // add trainer
    club.trainers = Array.isArray(club.trainers) ? club.trainers : [];
    if (!club.trainers.includes(user.id)) club.trainers.push(user.id);
    clubs[idx] = club;
    _setClubs(clubs);

    // add club to user's clubIds and set role to trainer
    const users = _getUsers();
    const uidx = users.findIndex(u => u.id === user.id);
    if (uidx !== -1) {
      const existingClubIds = users[uidx].clubIds || (users[uidx].clubId ? [users[uidx].clubId] : []);
      const nextClubIds = Array.from(new Set([...(existingClubIds || []), club.id]));
      users[uidx] = { ...users[uidx], role: ROLES.TRAINER, clubIds: nextClubIds };
      _setUsers(users);
    }

    const updatedUser = { ...(user || {}), role: ROLES.TRAINER, clubIds: Array.from(new Set([...(user?.clubIds||[]), club.id])) };
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    setUser(updatedUser);

    return { success: true, club };
  };

  // nominate assistant
  const nominateAssistant = async ({ targetUserId, clubId }) => {
    if (!user) throw new Error('Must be logged in to nominate assistants');
    const club = getClubById({ id: clubId });
    if (!club) throw new Error('Club not found');

    const isClubTrainer = Array.isArray(club.trainers) && club.trainers.includes(user.id);
    if (!isClubTrainer && user.role !== ROLES.ADMIN) throw new Error('Only a trainer of this club or admin can nominate assistants');

    club.assistants = Array.isArray(club.assistants) ? club.assistants : [];
    if (!club.assistants.includes(targetUserId)) club.assistants.push(targetUserId);

    // persist
    const clubs = _getClubs();
    const idx = clubs.findIndex(c => c.id === club.id);
    if (idx !== -1) {
      clubs[idx] = club;
      _setClubs(clubs);
    }

    // update target user record to assistant
    const users = _getUsers();
    const tidx = users.findIndex(u => u.id === targetUserId);
    if (tidx !== -1) {
      const existingClubIds = users[tidx].clubIds || (users[tidx].clubId ? [users[tidx].clubId] : []);
      const nextClubIds = Array.from(new Set([...(existingClubIds || []), club.id]));
      users[tidx] = { ...users[tidx], role: ROLES.ASSISTANT, clubIds: nextClubIds };
      _setUsers(users);

      // if target is current user, update session
      const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (cu && cu.id === targetUserId) {
        const updatedCu = { ...cu, role: ROLES.ASSISTANT, clubIds: nextClubIds };
        localStorage.setItem('currentUser', JSON.stringify(updatedCu));
        setUser(updatedCu);
      }
    }

    return { success: true, club };
  };

  // nominate trainer
  const nominateTrainer = async ({ targetUserId, clubId }) => {
    if (!user) throw new Error('Must be logged in to nominate trainers');
    const club = getClubById({ id: clubId });
    if (!club) throw new Error('Club not found');

    const isClubTrainerOrAdmin = (Array.isArray(club.trainers) && club.trainers.includes(user.id)) || user.role === ROLES.ADMIN;
    if (!isClubTrainerOrAdmin) throw new Error('Only a trainer of this club or admin can assign trainers');

    club.trainers = Array.isArray(club.trainers) ? club.trainers : [];
    if (!club.trainers.includes(targetUserId)) club.trainers.push(targetUserId);

    // persist
    const clubs = _getClubs();
    const idx = clubs.findIndex(c => c.id === club.id);
    if (idx !== -1) {
      clubs[idx] = club;
      _setClubs(clubs);
    }

    // update target user record to trainer
    const users = _getUsers();
    const uidx = users.findIndex(u => u.id === targetUserId);
    if (uidx !== -1) {
      const existingClubIds = users[uidx].clubIds || (users[uidx].clubId ? [users[uidx].clubId] : []);
      const nextClubIds = Array.from(new Set([...(existingClubIds || []), club.id]));
      users[uidx] = { ...users[uidx], role: ROLES.TRAINER, clubIds: nextClubIds };
      _setUsers(users);

      // if target is current user, update session
      const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (cu && cu.id === targetUserId) {
        const updatedCu = { ...cu, role: ROLES.TRAINER, clubIds: nextClubIds };
        localStorage.setItem('currentUser', JSON.stringify(updatedCu));
        setUser(updatedCu);
      }
    }

    return { success: true, club };
  };

  // list clubs where current user has any role
// list clubs where current user has any role
const listClubsForUser = ({ userId } = {}) => {
  const id = userId || (user && user.id);
  if (!id) return [];
  const clubs = _getClubs();

  // GLOBAL ADMIN: return *all* clubs
  if (user && user.role === ROLES.ADMIN) {
    return clubs;
  }

  return clubs.filter(c =>
    (Array.isArray(c.trainers) && c.trainers.includes(id)) ||
    (Array.isArray(c.assistants) && c.assistants.includes(id)) ||
    (Array.isArray(c.members) && c.members.includes(id)) ||
    c.createdBy === id
  );
};


  /* -----------------------------
     Join Requests
     -----------------------------*/
  const requestJoin = async ({ userId, clubId, teamId = null }) => {
    if (!userId || !clubId) throw new Error('userId and clubId are required');

    const club = getClubById({ id: clubId });
    if (!club) throw new Error('Club not found');

    // normalize arrays
    club.trainers = Array.isArray(club.trainers) ? club.trainers : [];
    club.assistants = Array.isArray(club.assistants) ? club.assistants : [];
    club.members = Array.isArray(club.members) ? club.members : [];

    if (
      club.trainers.includes(userId) ||
      club.assistants.includes(userId) ||
      club.members.includes(userId)
    ) {
      return { ok: false, message: 'You are already part of this club' };
    }

    const requests = _getRequests();
    const exists = requests.find(
      r =>
        r.userId === userId &&
        r.clubId === clubId &&
        (r.teamId || null) === (teamId || null) &&
        r.status === 'pending'
    );
    if (exists) return { ok: false, message: 'You already have a pending request' };

    const req = {
      id: _generateId('jr_'),
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

  // convenience wrapper: request join team using current user (for trainers who are already in club)
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

    // add to club.members and team.members if needed
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

    // update user record clubIds
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

  // leave club (removes trainer/assistant/membership)
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
  // Get all users (admin only)
  const listUsers = () => {
    if (!isAdmin()) {
      console.warn('listUsers: user is not admin');
      return [];
    }
    const allUsers = _getUsers();
    console.log('listUsers returned:', allUsers); // debug log
    return allUsers;
  };
// Update user (admin only)
  const updateUser = async ({ userId, updates }) => {
    if (!isAdmin()) throw new Error('Only admins can update users');
    
    const users = _getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    
    // Don't allow changing own admin role
    if (userId === user?.id && updates.role && updates.role !== ROLES.ADMIN) {
      throw new Error('Cannot change your own admin role');
    }
    
    users[idx] = { ...users[idx], ...updates };
    _setUsers(users);
    
    return { success: true, user: users[idx] };
  };

  // Delete user (admin only)
  const deleteUser = async ({ userId }) => {
    if (!isAdmin()) throw new Error('Only admins can delete users');
    
    // Don't allow deleting yourself
    if (userId === user?.id) {
      throw new Error('Cannot delete your own account');
    }
    
    const users = _getUsers();
    const filtered = users.filter(u => u.id !== userId);
    _setUsers(filtered);
    
    return { success: true };
  };

  // Change user password (admin only)
  const changeUserPassword = async ({ userId, newPassword }) => {
    if (!isAdmin()) throw new Error('Only admins can change passwords');
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    
    const users = _getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    
    users[idx] = { ...users[idx], password: newPassword };
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
    // clubs & trainer flows:
    createClub,
    createTeam,
    getClubByCode,
    getClubById,
    joinClubByCode,
    nominateAssistant,
    nominateTrainer,
    listClubsForUser,
    leaveClub,
    // join requests:
    requestJoin,
    requestJoinTeam,
    approveJoinRequest,
    denyJoinRequest,
    // roles:
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
