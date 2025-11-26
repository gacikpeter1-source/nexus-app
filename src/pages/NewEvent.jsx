// src/pages/NewEvent.jsx
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addEvent } from "../api/localApi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function NewEvent() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [form, setForm] = useState({
    title: "",
    type: "training",
    date: "",
    time: "",
    location: "",
    teamId: "",
    clubId: "",
    visibilityLevel: "personal",  // "personal" | "team" | "club"
    createdBy: "",
    description: "",
    recurrence: "",    // none | daily | weekly | monthly
    occurrences: "",   // integer (string in state)
    endDate: "",       // optional ISO date string "YYYY-MM-DD"
  });

  // Get teams from clubs instead of separate teams array
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      // Get all clubs from localStorage
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      
      // Get current user to filter clubs
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (!currentUser) return [];

      // Collect all teams from clubs user has access to
      const allTeams = [];
      
      clubs.forEach(club => {
        // Check if user is part of this club (trainer, assistant, or member)
        const isTrainer = (club.trainers || []).includes(currentUser.id);
        const isAssistant = (club.assistants || []).includes(currentUser.id);
        const isMember = (club.members || []).includes(currentUser.id);
        const isAdmin = currentUser.role === 'admin';
        
        if (isTrainer || isAssistant || isMember || isAdmin) {
          // Add all teams from this club with club info
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
      
      return allTeams;
    },
  });

  // Get clubs that user owns (SuperTrainer only)
  const { data: ownedClubs = [] } = useQuery({
    queryKey: ["ownedClubs"],
    queryFn: async () => {
      if (!user) return [];
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      return clubs.filter(c => c.superTrainer === user.id);
    },
    enabled: !!user
  });

  // Determine user's role capabilities
  const canCreateTeamEvents = user && ['admin', 'trainer', 'assistant'].includes(user.role);
  const canCreateClubEvents = user && user.isSuperTrainer && ownedClubs.length > 0;

  // Auto-set visibility and createdBy when user loads
  React.useEffect(() => {
    if (!user) return;
    
    setForm(f => ({ ...f, createdBy: user.id }));
    
    // Set default visibility based on role
    if (user.role === 'user' || user.role === 'parent') {
      setForm(f => ({ ...f, visibilityLevel: 'personal' }));
    } else if (canCreateTeamEvents && !canCreateClubEvents) {
      setForm(f => ({ ...f, visibilityLevel: 'team' }));
    }
  }, [user, canCreateTeamEvents, canCreateClubEvents]);

  const mutation = useMutation({
    // create an id and save via addEvent
    mutationFn: (payload) => {
      const id = `loc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const eventToSave = { ...payload, id };
      return addEvent(eventToSave);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      navigate("/calendar");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!form.title || !form.date) {
      alert("Please fill Title and Date");
      return;
    }
    
    // Visibility-specific validation
    if (form.visibilityLevel === 'team' && !form.teamId) {
      alert("Please select a team for team events");
      return;
    }
    
    if (form.visibilityLevel === 'club' && !form.clubId) {
      alert("Please select a club for club events");
      return;
    }
    
    // Permission check
    if (form.visibilityLevel === 'club' && !canCreateClubEvents) {
      alert("Only club owners can create club-wide events");
      return;
    }

    // If recurrence chosen, validate either occurrences or endDate (or both)
    if (form.recurrence) {
      const occ = Number(form.occurrences || 0);
      const hasOcc = Number.isInteger(occ) && occ > 0;
      const hasEnd = Boolean(form.endDate);

      if (!hasOcc && !hasEnd) {
        alert("For recurring events, provide either Occurrences (number) or an End date (or both).");
        return;
      }

      if (hasEnd) {
        // basic date validity check
        const start = new Date(form.date);
        const end = new Date(form.endDate);
        if (isNaN(end.getTime())) {
          alert("End date is invalid.");
          return;
        }
        if (end < start) {
          alert("End date must be the same or after the start date.");
          return;
        }
      }

      if (hasOcc && (!Number.isInteger(occ) || occ < 1)) {
        alert("Occurrences must be a whole number of 1 or more.");
        return;
      }
    }

    const eventData = {
      ...form,
      teamId: form.teamId || undefined,
      clubId: form.clubId || undefined,
      createdBy: user.id,
      // normalize occurrences to number when present
      occurrences: form.recurrence ? (form.occurrences ? Number(form.occurrences) : undefined) : undefined,
      endDate: form.endDate || undefined,
    };

    mutation.mutate(eventData);
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
            onChange={update("title")}
            required
          />
        </div>

        <div>
          <label className="block font-medium">Type</label>
          <select
            className="border rounded px-3 py-1 w-full"
            value={form.type}
            onChange={update("type")}
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
              onChange={update("date")}
              className="w-full border p-2 rounded"
              required
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-1">Time</div>
            <input
              type="time"
              value={form.time}
              onChange={update("time")}
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
            onChange={update("location")}
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
              onChange={update("clubId")}
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

        {/* Recurrence controls */}
        <div>
          <label className="block font-medium">Recurrence</label>
          <select
            className="border rounded px-3 py-1 w-full"
            value={form.recurrence}
            onChange={update("recurrence")}
          >
            <option value="">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {form.recurrence && (
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <div className="text-sm font-medium mb-1">Occurrences</div>
              <input
                type="number"
                min={1}
                value={form.occurrences}
                onChange={update("occurrences")}
                className="w-full border p-2 rounded"
                placeholder="How many times (e.g. 6)"
              />
            </label>

            <label className="block">
              <div className="text-sm font-medium mb-1">End Date</div>
              <input
                type="date"
                value={form.endDate}
                onChange={update("endDate")}
                className="w-full border p-2 rounded"
              />
            </label>
          </div>
        )}

        <div>
          <label className="block font-medium">Description</label>
          <textarea
            rows={3}
            className="border rounded px-3 py-1 w-full"
            value={form.description}
            onChange={update("description")}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Creating..." : "Create Event"}
          </button>
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            onClick={() => navigate("/calendar")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
