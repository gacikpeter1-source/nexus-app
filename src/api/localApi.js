// src/api/localApi.js
import users from "../data/users.json";
import teams from "../data/teams.json";
import baseEvents from "../data/events.json";
import currentUser from "../data/currentUser.json";
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
const LS_KEY = "sportsapp:localEvents";

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
    console.warn("Failed to save local events", e);
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
  return Promise.resolve(newTeam); // resolves like a normal API
}

// ---- CLUBS ----
export function getClubs() {
  return Promise.resolve(JSON.parse(localStorage.getItem('clubs') || '[]'));
}

// ---- JOIN REQUESTS ----
export function getJoinRequests() {
  return Promise.resolve(JSON.parse(localStorage.getItem('joinRequests') || '[]'));
}

export function createJoinRequest({ userId, clubId, teamId }) {
  const requests = JSON.parse(localStorage.getItem('joinRequests') || '[]');
  const newRequest = {
    id: 'jr-' + Date.now(),
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
  // return base events (from src/data/events.json) + local events (from localStorage)
  const base = structuredClone(baseEvents || []);
  const local = readLocalEvents();
  // ensure local events come after base events
  return [...base, ...local];
}

export async function getTeam(id) {
  if (id === undefined || id === null) return null;
  // teams is expected to be an array of team objects with .id field
  const found = (Array.isArray(teams) ? teams : []).find(t => String(t.id) === String(id));
  // structuredClone to preserve immutability like other API functions
  return structuredClone(found || null);
}

export async function getEvent(id) {
  const all = await getEvents();
  return all.find((e) => String(e.id) === String(id)) || null;
}

/**
 * addEvent(event)
 * - event must be an object with at least: id, title, date, team or teamId
 * - returns the saved event
 */
export async function addEvent(event) {
  const local = readLocalEvents();
  // simple dedupe: if id exists, override it
  const idx = local.findIndex((e) => String(e.id) === String(event.id));
  if (idx >= 0) {
    local[idx] = event;
  } else {
    local.push(event);
  }
  writeLocalEvents(local);
  return event;
}

/**
 * updateEvent(id, updates)
 * - Updates an existing event with the given id
 * - Only updates local events (not base events from JSON)
 * - returns the updated event or null if not found
 */
export async function updateEvent(id, updates) {
  const local = readLocalEvents();
  const idx = local.findIndex((e) => String(e.id) === String(id));
  if (idx < 0) {
    throw new Error(`Event ${id} not found in local events`);
  }
  // Merge updates with existing event
  local[idx] = { ...local[idx], ...updates };
  writeLocalEvents(local);
  return local[idx];
}

/**
 * deleteEvent(id)
 * - Deletes an event with the given id
 * - Only deletes from local events (not base events from JSON)
 * - returns true if deleted, false if not found
 */
export async function deleteEvent(id) {
  const local = readLocalEvents();
  const idx = local.findIndex((e) => String(e.id) === String(id));
  if (idx < 0) {
    return false; // Not found in local events
  }
  local.splice(idx, 1);
  writeLocalEvents(local);
  return true;
}
