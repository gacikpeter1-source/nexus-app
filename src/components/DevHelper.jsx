// src/components/DevHelper.jsx
// Dev helper with quick login and club tools (delete in production)

import { useState } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';

// Try to import helper components (if they exist)
let CreateClub, JoinClubByCode, NominateAssistant;
try {
   
  CreateClub = require('./CreateClub').default;
   
  JoinClubByCode = require('./JoinClubByCode').default;
   
  NominateAssistant = require('./NominateAssistant').default;
} catch (e) {
  CreateClub = null;
  JoinClubByCode = null;
  NominateAssistant = null;
}

const DevHelper = () => {
  const { user, logout, listClubsForUser } = useAuth();
  const [showHelper, setShowHelper] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [nominateEmail, setNominateEmail] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [msg, setMsg] = useState(null);

  const createTestUser = (role) => {
    const testUser = {
      id: Date.now().toString(),
      email: `${role}@test.com`,
      username: `test_${role}`,
      password: 'Password123',
      role,
      emailVerified: true,
      clubIds: [],
    };

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const existingIndex = users.findIndex(u => u.email === testUser.email);
    if (existingIndex >= 0) users[existingIndex] = testUser;
    else users.push(testUser);

    localStorage.setItem('users', JSON.stringify(users));

    const userData = {
      id: testUser.id,
      email: testUser.email,
      username: testUser.username,
      role: testUser.role,
      clubIds: [],
    };

    localStorage.setItem('currentUser', JSON.stringify(userData));
    window.location.reload();
  };

  const clearAllData = () => {
    if (window.confirm('Clear all data? This will log you out.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // --- Fallback helpers if components don't exist ---
  const fallbackCreateClub = async (name = 'Demo Club') => {
    try {
      setCreating(true);
      const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (!cu) throw new Error('Not logged in');

      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const clubId = `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
      const clubCode = String(Math.floor(100000 + Math.random()*900000));
      const club = {
        id: clubId,
        name: name.trim(),
        clubCode,
        createdBy: cu.id,
        createdAt: Date.now(),
        trainers: [cu.id],
        assistants: [],
        teams: [],
        members: [],
      };
      clubs.push(club);
      localStorage.setItem('clubs', JSON.stringify(clubs));

      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const ui = users.findIndex(u => u.id === cu.id);
      if (ui !== -1) {
        const existingClubIds = users[ui].clubIds || [];
        users[ui] = { ...users[ui], role: ROLES.TRAINER, clubIds: Array.from(new Set([...existingClubIds, clubId])) };
        localStorage.setItem('users', JSON.stringify(users));
      }

      const newCU = { ...cu, role: ROLES.TRAINER, clubIds: Array.from(new Set([...(cu.clubIds || []), clubId])) };
      localStorage.setItem('currentUser', JSON.stringify(newCU));

      setMsg({ ok: true, text: `Created club "${club.name}" (code: ${club.clubCode})` });
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Create failed' });
    } finally {
      setCreating(false);
    }
  };

  const fallbackJoinClub = async (code) => {
    try {
      setMsg(null);
      const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (!cu) throw new Error('Not logged in');

      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const club = clubs.find(c => String(c.clubCode) === String(code));
      if (!club) throw new Error('Invalid club code');

      if (!club.trainers.includes(cu.id)) club.trainers.push(cu.id);
      localStorage.setItem('clubs', JSON.stringify(clubs));

      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const uidx = users.findIndex(u => u.id === cu.id);
      if (uidx !== -1) {
        const existingClubIds = users[uidx].clubIds || [];
        users[uidx] = { ...users[uidx], role: ROLES.TRAINER, clubIds: Array.from(new Set([...existingClubIds, club.id])) };
        localStorage.setItem('users', JSON.stringify(users));
      }

      const newCU = { ...cu, role: ROLES.TRAINER, clubIds: Array.from(new Set([...(cu.clubIds || []), club.id])) };
      localStorage.setItem('currentUser', JSON.stringify(newCU));

      setMsg({ ok: true, text: `Joined club "${club.name}" as Trainer` });
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Join failed' });
    }
  };

  const fallbackNominate = async (clubId, email) => {
    try {
      setMsg(null);
      const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (!cu) throw new Error('Not logged in');

      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const club = clubs.find(c => c.id === clubId);
      if (!club) throw new Error('Club not found');
      if (!club.trainers.includes(cu.id) && cu.role !== ROLES.ADMIN) throw new Error('Only a club trainer or admin can nominate');

      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const target = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!target) throw new Error('Target user not found');

      if (!club.assistants.includes(target.id)) club.assistants.push(target.id);
      localStorage.setItem('clubs', JSON.stringify(clubs));

      const tidx = users.findIndex(u => u.id === target.id);
      const existingClubIds = users[tidx].clubIds || [];
      users[tidx] = { ...users[tidx], role: ROLES.ASSISTANT, clubIds: Array.from(new Set([...existingClubIds, club.id])) };
      localStorage.setItem('users', JSON.stringify(users));

      const cu2 = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (cu2 && cu2.id === target.id) {
        localStorage.setItem('currentUser', JSON.stringify({ ...cu2, role: ROLES.ASSISTANT, clubIds: Array.from(new Set([...existingClubIds, club.id])) }));
        window.location.reload();
      }

      setMsg({ ok: true, text: `${target.email} nominated as assistant for ${club.name}` });
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Nomination failed' });
    }
  };

  const userClubs = () => {
    if (!user) return [];
    try {
      if (!listClubsForUser) {
        const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
        const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (!cu) return [];
        return clubs.filter(c =>
          (c.trainers || []).includes(cu.id) ||
          (c.assistants || []).includes(cu.id) ||
          c.createdBy === cu.id
        );
      }
      return listClubsForUser();
    } catch {
      return [];
    }
  };

  const allClubs = JSON.parse(localStorage.getItem('clubs') || '[]');

  // --- Render ---
  //if (!user) return null; // Only render if user is logged in (dev safety)
if (!user || ![ROLES.ADMIN, ROLES.TRAINER, ROLES.ASSISTANT].includes(user.role)) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!showHelper ? (
        <button
          onClick={() => setShowHelper(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700"
        >
          🔧 Dev Tools
        </button>
      ) : (
        <div className="bg-white rounded-lg shadow-2xl p-4 w-96 max-h-[70vh] overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-lg">Dev Helper</h3>
            <button onClick={() => setShowHelper(false)} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>

          {/* Logged in user info */}
          <div className="mb-3 p-2 bg-green-50 rounded">
            <div className="text-xs text-green-700">Logged in as</div>
            <div className="font-medium">{user.email}</div>
            <div className="text-xs text-green-600">
              Role: {user.role}
              {user.clubIds && user.clubIds.length > 0 ? ` — clubs: ${user.clubIds.join(', ')}` : ''}
            </div>
          </div>

          {/* Quick login buttons */}
          <div className="text-sm font-medium text-gray-700 mb-2">Quick Login As:</div>
          <div className="grid gap-2 mb-3">
            <button onClick={() => createTestUser(ROLES.ADMIN)} className="w-full bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded text-sm">👑 Admin</button>
            <button onClick={() => createTestUser(ROLES.TRAINER)} className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded text-sm">🏋️ Trainer</button>
            <button onClick={() => createTestUser(ROLES.ASSISTANT)} className="w-full bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded text-sm">👥 Assistant</button>
            <button onClick={() => createTestUser(ROLES.USER)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded text-sm">🙋 User</button>
            <button onClick={() => createTestUser(ROLES.PARENT)} className="w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-2 rounded text-sm">👨‍👩‍👧 Parent</button>
          </div>

          {/* Club tools (fallback create/join/nominate) */}
          <div className="space-y-2">
            {/* Create Club */}
            <div>
              {CreateClub ? <CreateClub /> : (
                <div className="p-2 bg-white rounded shadow">
                  <div className="text-sm mb-2">Quick create a club (fallback)</div>
                  <button disabled={creating} onClick={() => fallbackCreateClub('Dev Club')} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">
                    {creating ? 'Creating…' : 'Create Club (fallback)'}
                  </button>
                </div>
              )}
            </div>

            {/* Join Club */}
            <div>
              {JoinClubByCode ? <JoinClubByCode /> : (
                <div className="p-2 bg-white rounded shadow space-y-2">
                  <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="842159" className="w-full border p-2 rounded text-sm" />
                  <div className="flex gap-2">
                    <button disabled={!joinCode} onClick={() => fallbackJoinClub(joinCode)} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Join</button>
                    <button onClick={() => setJoinCode('')} className="px-3 py-2 bg-gray-100 rounded text-sm">Clear</button>
                  </div>
                </div>
              )}
            </div>

            {/* Nominate Assistant */}
            <div>
              <div className="text-sm mb-1">Nominate Assistant</div>
              <div className="space-y-2 p-2 bg-white rounded shadow">
                <select value={selectedClubId} onChange={(e) => setSelectedClubId(e.target.value)} className="w-full border p-2 rounded text-sm">
                  <option value="">Select club…</option>
                  {userClubs().map(c => <option key={c.id} value={c.id}>{c.name} — {c.clubCode}</option>)}
                </select>
                <input value={nominateEmail} onChange={(e) => setNominateEmail(e.target.value)} placeholder="user@example.com" className="w-full border p-2 rounded text-sm" />
                <div className="flex gap-2">
                  <button disabled={!selectedClubId || !nominateEmail} onClick={() => fallbackNominate(selectedClubId, nominateEmail)} className="px-3 py-2 bg-green-600 text-white rounded text-sm">Nominate</button>
                  <button onClick={() => { setSelectedClubId(''); setNominateEmail(''); setMsg(null); }} className="px-3 py-2 bg-gray-100 rounded text-sm">Clear</button>
                </div>
              </div>
            </div>

            {/* Messages */}
            {msg && <div className={`p-2 rounded text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}

            {/* Logout / Clear Data */}
            <div className="flex gap-2 mt-2">
              {user && <button onClick={logout} className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-2 rounded text-sm">🚪 Logout</button>}
              <button onClick={clearAllData} className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded text-sm">🗑️ Clear All Data</button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 p-2 bg-gray-50 text-xs rounded text-gray-600">
            <div className="font-medium mb-1">Test Credentials</div>
            <div>Email: [role]@test.com</div>
            <div>Password: Password123</div>
            <div className="mt-1 text-xs text-gray-500">Dev helper — remove or hide in production</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevHelper;
