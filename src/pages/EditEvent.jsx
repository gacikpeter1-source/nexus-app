// src/pages/EditEvent.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getEvent, updateEvent } from '../firebase/firestore';

export default function EditEvent() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState(null);
  
  const [form, setForm] = useState({
    title: '',
    type: 'training',
    date: '',
    time: '',
    location: '',
    description: '',
  });

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  async function loadEvent() {
    try {
      setLoading(true);
      const eventData = await getEvent(eventId);
      
      if (!eventData) {
        showToast('Event not found', 'error');
        navigate('/calendar');
        return;
      }

      setEvent(eventData);
      setForm({
        title: eventData.title || '',
        type: eventData.type || 'training',
        date: eventData.date || '',
        time: eventData.time || '',
        location: eventData.location || '',
        description: eventData.description || '',
      });
    } catch (error) {
      console.error('Error loading event:', error);
      showToast('Failed to load event', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!form.title || !form.date) {
      showToast('Please fill Title and Date', 'error');
      return;
    }

    try {
      setSaving(true);
      await updateEvent(eventId, form);
      showToast('Event updated successfully', 'success');
      navigate(`/event/${eventId}`);
    } catch (error) {
      console.error('Error updating event:', error);
      showToast('Failed to update event', 'error');
    } finally {
      setSaving(false);
    }
  }

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light/60">Loading event...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light/60">Event not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(`/event/${eventId}`)}
        className="mb-4 flex items-center gap-2 text-light/60 hover:text-light transition-colors"
      >
        <span>←</span>
        <span>Back to Event</span>
      </button>

      <h1 className="font-title text-4xl text-light mb-6">Edit Event</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-xl">
        {/* Event Type Badge */}
        {event.visibilityLevel && (
          <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-sm text-light">
              <strong>Event Type:</strong>{' '}
              {event.visibilityLevel === 'personal' && '👤 Personal'}
              {event.visibilityLevel === 'team' && '👥 Team'}
              {event.visibilityLevel === 'club' && '🏛️ Club'}
            </p>
            <p className="text-xs text-light/60 mt-1">
              You cannot change the event type or team/club assignment while editing.
            </p>
          </div>
        )}

        <div>
          <label className="block font-medium text-light/80 mb-2">Title *</label>
          <input
            type="text"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={form.title}
            onChange={update('title')}
            required
            placeholder="Event title"
          />
        </div>

        <div>
          <label className="block font-medium text-light/80 mb-2">Type</label>
          <select
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={form.type}
            onChange={update('type')}
          >
            <option value="training" className="bg-mid-dark">Training</option>
            <option value="game" className="bg-mid-dark">Game</option>
            <option value="match" className="bg-mid-dark">Match</option>
            <option value="tournament" className="bg-mid-dark">Tournament</option>
            <option value="meeting" className="bg-mid-dark">Meeting</option>
            <option value="social" className="bg-mid-dark">Social</option>
            <option value="other" className="bg-mid-dark">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-light/80 mb-2">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={update('date')}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-light/80 mb-2">Time</label>
            <input
              type="time"
              value={form.time}
              onChange={update('time')}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block font-medium text-light/80 mb-2">Location</label>
          <input
            type="text"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={form.location}
            onChange={update('location')}
            placeholder="Event location"
          />
        </div>

        <div>
          <label className="block font-medium text-light/80 mb-2">Description</label>
          <textarea
            rows={4}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            value={form.description}
            onChange={update('description')}
            placeholder="Event description"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-primary hover:bg-primary/80 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            className="px-6 py-3 bg-white/10 text-light rounded-lg hover:bg-white/15 font-medium transition-all"
            onClick={() => navigate(`/event/${eventId}`)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
