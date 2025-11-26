// src/pages/EditEvent.jsx
import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updateEvent, getEvent, getCurrentUser } from "../api/localApi";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function EditEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  // Load the existing event
  const { data: existingEvent, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => getEvent(id),
  });

  const [form, setForm] = useState({
    title: "",
    type: "training",
    date: "",
    time: "",
    location: "",
    description: "",
    teamId: "",
    clubId: "",
    visibilityLevel: "personal",
  });

  // Populate form when event loads
  useEffect(() => {
    if (existingEvent) {
      setForm({
        title: existingEvent.title || "",
        type: existingEvent.type || "training",
        date: existingEvent.date || "",
        time: existingEvent.time || "",
        location: existingEvent.location || "",
        description: existingEvent.description || "",
        teamId: existingEvent.teamId || "",
        clubId: existingEvent.clubId || "",
        visibilityLevel: existingEvent.visibilityLevel || "personal",
      });
    }
  }, [existingEvent]);

  const mutation = useMutation({
    mutationFn: (updates) => updateEvent(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event", id] });
      navigate(`/events/${id}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!form.title || !form.date) {
      alert("Please fill Title and Date");
      return;
    }

    mutation.mutate(form);
  };

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  if (isLoading) return <div className="p-6">Loading event...</div>;
  if (!existingEvent) return <div className="p-6">Event not found.</div>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Edit Event</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded shadow">
        {/* Event info badge */}
        {existingEvent.visibilityLevel && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              <strong>Event Type:</strong> {
                existingEvent.visibilityLevel === 'personal' ? '👤 Personal' :
                existingEvent.visibilityLevel === 'team' ? '👥 Team' :
                '🏛️ Club'
              }
            </p>
            <p className="text-xs text-blue-600 mt-1">
              You cannot change the event type or team/club assignment while editing.
            </p>
          </div>
        )}

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
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            onClick={() => navigate(`/events/${id}`)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
