// src/pages/NewEvent.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createEvent, getAllClubs } from '../firebase/firestore';

export default function NewEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [teams, setTeams] = useState([]);

  const [form, setForm] = useState({
    title: '',
    type: 'training',
    date: '',
    time: '',
    location: '',
    teamId: '',
    clubId: '',
    visibilityLevel: 'personal',  // "personal" | "team" | "club"
    createdBy: '',
    description: '',
    responses: {} // Initialize empty responses object
  });

  // Load clubs on mount
  useEffect(() => {
    loadClubs();
  }, []);

  async function loadClubs() {
    try {
      const allClubs = await getAllClubs();
      setClubs(allClubs);

      // Extract teams from clubs
      const allTeams = [];
      allClubs.forEach(club => {
        // Check if user is part of this club
        const isTrainer = (club.trainers || []).includes(user?.id);
        const isAssistant = (club.assistants || []).includes(user?.id);
        const isMember = (club.members || []).includes(user?.id);
        const isAdmin = user?.role === 'admin' || user?.isSuperAdmin;

        if (isTrainer || isAssistant || isMember || isAdmin) {
          const clubTeams = club.teams || [];
          clubTeams.forEach(team => {
            allTeams.push({
              ...team,
              clubId: club.id,
              clubName: club.name,
              displayName: `${team.name} (${club.name})`
            });
          });
        }
      });

      setTeams(allTeams);
    } catch (error) {
      console.error('Error loading clubs:', error);
      showToast('Failed to load clubs', 'error');
    }
  }

  // Get clubs that user owns (SuperTrainer only)
  const ownedClubs = clubs.filter(c => c.createdBy === user?.id);

  // Get clubs where user is trainer or assistant
  const clubsWhereTrainerOrAssistant = clubs.filter(c => 
    (c.trainers || []).includes(user?.id) || 
    (c.assistants || []).includes(user?.id)
  );

  // Determine user's role capabilities
  const canCreateTeamEvents = user && (
    user.role === 'admin' || 
    user.isSuperAdmin ||
    user.role === 'trainer' || 
    user.role === 'assistant' ||
    clubsWhereTrainerOrAssistant.length > 0
  );
  
  const canCreateClubEvents = user && (
    user.isSuperAdmin || 
    user.role === 'admin' || 
    ownedClubs.length > 0
  );

  // Auto-set createdBy when user loads
  useEffect(() => {
    if (!user) return;
    
    setForm(f => ({ ...f, createdBy: user.id }));
    
    // Set default visibility based on capabilities
    if (!canCreateTeamEvents && !canCreateClubEvents) {
      // Regular users - only personal
      setForm(f => ({ ...f, visibilityLevel: 'personal' }));
    } else if (canCreateTeamEvents && !canCreateClubEvents) {
      // Trainers/Assistants - default to team
      setForm(f => ({ ...f, visibilityLevel: 'team' }));
    }
    // SuperAdmin/Club owners can choose - leave as is
  }, [user, canCreateTeamEvents, canCreateClubEvents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!form.title || !form.date) {
      showToast('Please fill Title and Date', 'error');
      return;
    }
    
    // Visibility-specific validation
    if (form.visibilityLevel === 'team' && !form.teamId) {
      showToast('Please select a team for team events', 'error');
      return;
    }
    
    if (form.visibilityLevel === 'club' && !form.clubId) {
      showToast('Please select a club for club events', 'error');
      return;
    }
    
    // Permission check
    if (form.visibilityLevel === 'club' && !canCreateClubEvents) {
      showToast('Only club owners can create club-wide events', 'error');
      return;
    }

    const eventData = {
      ...form,
      teamId: form.teamId || undefined,
      clubId: form.clubId || undefined,
      createdBy: user.id,
      responses: {} // Initialize empty responses
    };

    try {
      setLoading(true);
      await createEvent(eventData);
      showToast('Event created successfully!', 'success');
      navigate('/calendar');
    } catch (error) {
      console.error('Error creating event:', error);
      showToast('Failed to create event', 'error');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create Event</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded shadow">
        <div>
          <label className="block font-medium">Title</label>
          <input
            type="text"
            className="border rounded px-3 py-1 w-full"
            value={form.title}
            onChange={update('title')}
            required
          />
        </div>

        <div>
          <label className="block font-medium">Type</label>
          <select
            className="border rounded px-3 py-1 w-full"
            value={form.type}
            onChange={update('type')}
          >
            <option value="training">Training</option>
            <option value="game">Game</option>
            <option value="match">Match</option>
            <option value="meeting">Meeting</option>
            <option value="social">Social</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm font-medium mb-1">Date</div>
            <input
              type="date"
              value={form.date}
              onChange={update('date')}
              className="w-full border p-2 rounded"
              required
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-1">Time</div>
            <input
              type="time"
              value={form.time}
              onChange={update('time')}
              className="w-full border p-2 rounded"
            />
          </label>
        </div>

        <div>
          <label className="block font-medium">Location</label>
          <input
            type="text"
            className="border rounded px-3 py-1 w-full"
            value={form.location}
            onChange={update('location')}
          />
        </div>

        {/* Visibility Level Selector */}
        <div>
          <label className="block font-medium mb-2">Event Visibility</label>
          
          <select
            className="border rounded px-3 py-2 w-full"
            value={form.visibilityLevel}
            onChange={(e) => {
              const level = e.target.value;
              
              // Clear fields based on visibility level
              if (level === 'personal') {
                // Personal: clear both team and club
                setForm(f => ({ ...f, visibilityLevel: level, teamId: '', clubId: '' }));
              } else if (level === 'team') {
                // Team: keep clubId (will be set from team), clear if switching from club
                setForm(f => ({ ...f, visibilityLevel: level, clubId: '' }));
              } else if (level === 'club') {
                // Club: clear teamId, keep clubId
                setForm(f => ({ ...f, visibilityLevel: level, teamId: '' }));
              }
            }}
          >
            <option value="personal">👤 Personal (Only I can see)</option>
            {canCreateTeamEvents && (
              <option value="team">👥 Team (Team members can see)</option>
            )}
            {canCreateClubEvents && (
              <option value="club">🏛️ Club (All club members can see)</option>
            )}
          </select>
          
          <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
            {form.visibilityLevel === 'personal' && (
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Personal Event:</strong> This event will only be visible to you. Use this for personal goals, reminders, or private training sessions.
              </p>
            )}
            {form.visibilityLevel === 'team' && (
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Team Event:</strong> This event will be visible to all members of the selected team. Perfect for team practices, matches, and meetings.
              </p>
            )}
            {form.visibilityLevel === 'club' && (
              <p className="text-sm text-orange-800 bg-orange-50 border-orange-200 p-3 rounded-lg border">
                <strong>⭐ Club-Wide Event:</strong> This event will be visible to ALL members across ALL teams in the selected club. Use for club-wide announcements, BBQs, tournaments, etc.
              </p>
            )}
          </div>
        </div>

        {/* Team Selector (for team events) */}
        {form.visibilityLevel === 'team' && (
          <div>
            <label className="block font-medium">Team *</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.teamId}
              onChange={(e) => {
                const teamId = e.target.value;
                setForm(f => ({ ...f, teamId }));
                // Auto-set clubId from selected team
                const team = teams.find(t => t.id === teamId);
                if (team) {
                  setForm(f => ({ ...f, clubId: team.clubId }));
                }
              }}
              required
            >
              <option value="">-- choose team --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName || t.name}
                </option>
              ))}
            </select>
            {teams.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">
                No teams available. Create a team in Club Management first.
              </p>
            )}
          </div>
        )}

        {/* Club Selector (for club events - SuperTrainer only) */}
        {form.visibilityLevel === 'club' && canCreateClubEvents && (
          <div>
            <label className="block font-medium">Club *</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.clubId}
              onChange={update('clubId')}
              required
            >
              <option value="">-- choose club --</option>
              {ownedClubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-orange-600 mt-1 font-medium">
              ⭐ All teams in this club will see this event
            </p>
          </div>
        )}

        <div>
          <label className="block font-medium">Description</label>
          <textarea
            rows={3}
            className="border rounded px-3 py-1 w-full"
            value={form.description}
            onChange={update('description')}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/80 font-medium transition-all"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            onClick={() => navigate('/calendar')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
