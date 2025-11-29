// src/api/localApi.js
import users from '../data/users.json';
import teams from '../data/teams.json';
import baseEvents from '../data/events.json';
import currentUser from '../data/currentUser.json';
import clubsData from '../data/clubs.json'; // NEW: Import clubs data

export const getCurrentUser = async () => {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    try {
      return JSON.parse(storedUser);
    } catch (e) {
      console.error('Failed to parse currentUser:', e);
    }
  }
  return currentUser;
};

const LS_KEY = 'sportsapp:localEvents';
const CLUBS_KEY = 'sportsapp:localClubs'; // NEW: Key for clubs in localStorage

/** helpers **/
function readLocalEvents() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalEvents(arr) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn('Failed to save local events', e);
  }
}

// NEW: Helpers for clubs
function readLocalClubs() {
  try {
    const raw = localStorage.getItem(CLUBS_KEY);
    if (!raw) {
      // Initialize with default clubs from JSON file
      writeLocalClubs(clubsData || []);
      return clubsData || [];
    }
    return JSON.parse(raw);
  } catch {
    return clubsData || [];
  }
}

function writeLocalClubs(arr) {
  try {
    localStorage.setItem(CLUBS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn('Failed to save local clubs', e);
  }
}

/** exported API **/

export async function getUsers() {
  return structuredClone(users);
}

// ---- TEAMS ----
export function getTeams() {
  return Promise.resolve(JSON.parse(localStorage.getItem('teams') || '[]'));
}

export function createTeam(newTeam) {
  const teams = JSON.parse(localStorage.getItem('teams') || '[]');
  teams.push(newTeam);
  localStorage.setItem('teams', JSON.stringify(teams));
  return Promise.resolve(newTeam);
}

// ---- CLUBS ---- (UPDATED)
export function getClubs() {
  const clubs = readLocalClubs();
  return Promise.resolve(structuredClone(clubs));
}

export function createClub(newClub) {
  const clubs = readLocalClubs();
  clubs.push(newClub);
  writeLocalClubs(clubs);
  return Promise.resolve(newClub);
}

export function updateClub(clubId, updates) {
  const clubs = readLocalClubs();
  const idx = clubs.findIndex(c => c.id === clubId);
  if (idx >= 0) {
    clubs[idx] = { ...clubs[idx], ...updates };
    writeLocalClubs(clubs);
    return Promise.resolve(clubs[idx]);
  }
  return Promise.reject(new Error('Club not found'));
}

export function deleteClub(clubId) {
  const clubs = readLocalClubs();
  const filtered = clubs.filter(c => c.id !== clubId);
  writeLocalClubs(filtered);
  return Promise.resolve({ success: true });
}

// ---- JOIN REQUESTS ----
export function getJoinRequests() {
  return Promise.resolve(JSON.parse(localStorage.getItem('joinRequests') || '[]'));
}

export function createJoinRequest({ userId, clubId, teamId }) {
  const requests = JSON.parse(localStorage.getItem('joinRequests') || '[]');
  const newRequest = {
    id: `jr-${Date.now()}`,
    userId,
    clubId: clubId || null,
    teamId: teamId || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  requests.push(newRequest);
  localStorage.setItem('joinRequests', JSON.stringify(requests));
  return Promise.resolve(newRequest);
}

// ---- EVENTS ----
export async function getEvents() {
  const base = structuredClone(baseEvents || []);
  const local = readLocalEvents();
  return [...base, ...local];
}

export async function getTeam(id) {
  if (id === undefined || id === null) return null;
  const found = (Array.isArray(teams) ? teams : []).find(t => String(t.id) === String(id));
  return structuredClone(found || null);
}

export async function getEvent(id) {
  const all = await getEvents();
  return all.find((e) => String(e.id) === String(id)) || null;
}

export async function addEvent(event) {
  const local = readLocalEvents();
  const idx = local.findIndex((e) => String(e.id) === String(event.id));
  if (idx >= 0) {
    local[idx] = event;
  } else {
    local.push(event);
  }
  writeLocalEvents(local);
  return event;
}

export async function updateEvent(id, updates) {
  const local = readLocalEvents();
  const idx = local.findIndex((e) => String(e.id) === String(id));
  if (idx < 0) {
    throw new Error(`Event ${id} not found in local events`);
  }
  local[idx] = { ...local[idx], ...updates };
  writeLocalEvents(local);
  return local[idx];
}

export async function deleteEvent(id) {
  const local = readLocalEvents();
  const idx = local.findIndex((e) => String(e.id) === String(id));
  if (idx < 0) {
    return false;
  }
  local.splice(idx, 1);
  writeLocalEvents(local);
  return true;
}
