// src/pages/CreateClub.jsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function CreateClub() {
  const [name, setName] = useState('');
  const [initialTeamName, setInitialTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // get functions from auth
  const { user, createClub, createTeam, refreshUser } = useAuth();

  async function onCreate(e) {
    e.preventDefault();
    setBusy(true);
    setResult(null);

    try {
      if (!user) {
        throw new Error('You must be logged in to create a club.');
      }

      const trimmedName = String(name || '').trim();
      if (!trimmedName || trimmedName.length < 2) {
        throw new Error('Club name must be at least 2 characters');
      }

      // 1) create club
      if (typeof createClub !== 'function') throw new Error('createClub is not available');
      const { club } = await createClub({ name: trimmedName });

      // 2) optionally create an initial team inside the new club
      let team = null;
      const trimmedTeam = String(initialTeamName || '').trim();
      if (trimmedTeam && trimmedTeam.length >= 2 && typeof createTeam === 'function') {
        const r = await createTeam({ clubId: club.id, name: trimmedTeam, description: '' });
        team = r?.team || null;
      }

      // 3) refresh auth user so currentUser gets updated (clubIds migration)
      if (typeof refreshUser === 'function') {
        try { await refreshUser(); } catch (err) { /* ignore refresh errors */ }
      }

      setResult({ success: true, club, team });
      setName('');
      setInitialTeamName('');
    } catch (err) {
      setResult({ success: false, message: err?.message || 'Failed to create club' });
    } finally {
      setBusy(false);
    }
  }

  // UI-level helpers
  const canSubmit = !busy && String(name || '').trim().length >= 2;

  if (!user) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <h3 className="text-lg font-semibold mb-2">Create Club</h3>
        <div className="p-3 bg-yellow-50 border border-yellow-100 text-yellow-800 rounded">
          You must be logged in to create a club.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="text-lg font-semibold mb-2">Create Club</h3>
      <form onSubmit={onCreate} className="space-y-3">
        <div>
          <label htmlFor="clubName" className="block text-sm font-medium mb-1">Club name</label>
          <input
            id="clubName"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Club name (e.g. Football Club London)"
            className="w-full border p-2 rounded"
            aria-label="Club name"
          />
          <div className="text-xs text-gray-500 mt-1">At least 2 characters.</div>
        </div>

        <div>
          <label htmlFor="initialTeam" className="block text-sm font-medium mb-1">Initial team (optional)</label>
          <input
            id="initialTeam"
            value={initialTeamName}
            onChange={e => setInitialTeamName(e.target.value)}
            placeholder="Initial team name (optional)"
            className="w-full border p-2 rounded"
            aria-label="Initial team name"
          />
          <div className="text-xs text-gray-500 mt-1">
            If provided, an initial team will be created and you will be added as its trainer/member.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            disabled={!canSubmit}
            type="submit"
            className={`px-4 py-2 text-white rounded ${canSubmit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
          >
            {busy ? 'Creating…' : 'Create Club'}
          </button>
        </div>
      </form>

      {result && result.success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded">
          <div>Club created: <span className="font-medium">{result.club.name}</span></div>
          <div className="text-xs mt-1">Code: <code className="font-mono">{result.club.clubCode}</code></div>
          {result.team && (
            <div className="mt-2 text-sm">
              Initial team created: <span className="font-medium">{result.team.name}</span>
            </div>
          )}
          <div className="text-sm mt-2">Share this club code with people you want to make Trainers for this club.</div>
        </div>
      )}

      {result && !result.success && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded">{result.message}</div>
      )}
    </div>
  );
}
