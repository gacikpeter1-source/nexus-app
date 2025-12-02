// src/pages/EditEvent.jsx - COMPLETE WITH ALL FEATURES
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
  
  // File attachment state
  const [attachedFile, setAttachedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  
  // Recurrence configuration state
  const [showRecurrenceConfig, setShowRecurrenceConfig] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);
  const [monthlyPattern, setMonthlyPattern] = useState('date');
  const [monthlyWeek, setMonthlyWeek] = useState('first');
  const [monthlyDay, setMonthlyDay] = useState('monday');
  
  const [form, setForm] = useState({
    title: '',
    type: '',
    date: '',
    time: '',
    occurrence: 'once',
    recurrenceConfig: {
      weekdays: [],
      monthlyPattern: 'date',
      monthlyWeek: 'first',
      monthlyDay: 'monday'
    },
    location: '',
    description: '',
    participantLimit: null,
    attachmentUrl: null,
    attachmentName: null
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
      
      // Pre-fill form with event data
      setForm({
        title: eventData.title || '',
        type: eventData.type || '',
        date: eventData.date || '',
        time: eventData.time || '',
        occurrence: eventData.occurrence || 'once',
        recurrenceConfig: eventData.recurrenceConfig || {
          weekdays: [],
          monthlyPattern: 'date',
          monthlyWeek: 'first',
          monthlyDay: 'monday'
        },
        location: eventData.location || '',
        description: eventData.description || '',
        participantLimit: eventData.participantLimit || null,
        attachmentUrl: eventData.attachmentUrl || null,
        attachmentName: eventData.attachmentName || null
      });

      // Set recurrence state
      if (eventData.occurrence && eventData.occurrence !== 'once') {
        setShowRecurrenceConfig(true);
        if (eventData.recurrenceConfig) {
          setSelectedWeekdays(eventData.recurrenceConfig.weekdays || []);
          setMonthlyPattern(eventData.recurrenceConfig.monthlyPattern || 'date');
          setMonthlyWeek(eventData.recurrenceConfig.monthlyWeek || 'first');
          setMonthlyDay(eventData.recurrenceConfig.monthlyDay || 'monday');
        }
      }

      // Set file preview if attachment exists
      if (eventData.attachmentUrl) {
        setFilePreview(eventData.attachmentUrl);
      }

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

    if (!form.type.trim()) {
      showToast('Event type is required', 'error');
      return;
    }

    try {
      setSaving(true);
      
      const updateData = {
        title: form.title.trim(),
        type: form.type.trim() || 'Other',
        date: form.date,
        time: form.time,
        occurrence: form.occurrence,
        recurrenceConfig: form.recurrenceConfig,
        location: form.location,
        description: form.description,
        participantLimit: form.participantLimit || null
      };

      // Add attachment if exists
      if (form.attachmentUrl) {
        updateData.attachmentUrl = form.attachmentUrl;
        updateData.attachmentName = form.attachmentName;
      }

      await updateEvent(eventId, updateData);
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

  function handleFileAttachment(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      showToast('File must be less than 10MB', 'error');
      return;
    }
    
    setAttachedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview('');
    }
    
    // Convert to base64 for storage
    const reader2 = new FileReader();
    reader2.onloadend = () => {
      setForm(f => ({
        ...f,
        attachmentUrl: reader2.result,
        attachmentName: file.name
      }));
    };
    reader2.readAsDataURL(file);
  }

  function removeAttachment() {
    setAttachedFile(null);
    setFilePreview('');
    setForm(f => ({ ...f, attachmentUrl: null, attachmentName: null }));
  }

  function toggleWeekday(day) {
    setSelectedWeekdays(prev => {
      const newDays = prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day];
      
      setForm(f => ({
        ...f,
        recurrenceConfig: { ...f.recurrenceConfig, weekdays: newDays }
      }));
      
      return newDays;
    });
  }

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
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(`/event/${eventId}`)}
        className="mb-4 flex items-center gap-2 text-sm text-light/60 hover:text-light transition-colors"
      >
        <span>←</span>
        <span>Back to Event</span>
      </button>

      <h1 className="font-title text-3xl text-light mb-6 flex items-center gap-3">
        <span className="w-1 h-8 bg-primary rounded"></span>
        Edit Event
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 shadow-2xl">
        {/* Event Type Badge */}
        {event.visibilityLevel && (
          <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-sm text-light">
              <strong>Visibility:</strong>{' '}
              {event.visibilityLevel === 'personal' && '👤 Personal'}
              {event.visibilityLevel === 'team' && '👥 Team'}
              {event.visibilityLevel === 'club' && '🏛️ Club'}
            </p>
            <p className="text-xs text-light/60 mt-1">
              You cannot change the visibility or team/club assignment while editing.
            </p>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block font-medium text-light/80 mb-1">Title *</label>
          <input
            type="text"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={form.title}
            onChange={update('title')}
            placeholder="e.g., Big Football Match"
            required
          />
        </div>

        {/* Type and Limit - Compact Row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-medium text-light/80 mb-1">Type</label>
            <input
              type="text"
              list="type-suggestions"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              value={form.type}
              onChange={(e) => {
                setForm(f => ({ ...f, type: e.target.value }));
              }}
              placeholder="Type or select..."
              autoComplete="off"
            />
            <datalist id="type-suggestions">
              <option value="Training" />
              <option value="Game" />
              <option value="Match" />
              <option value="Meeting" />
              <option value="Social" />
              <option value="Tournament" />
            </datalist>
          </div>

          <div className="col-span-2">
            <label className="block font-medium text-light/80 mb-1">Participant Limit</label>
            <input
              type="text"
              list="limit-suggestions"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              value={form.participantLimit === null ? '' : form.participantLimit}
              onChange={(e) => {
                const value = e.target.value.trim();
                if (value === '' || value.toLowerCase() === 'no limit') {
                  setForm(f => ({ ...f, participantLimit: null }));
                } else {
                  const num = parseInt(value);
                  if (!isNaN(num) && num > 0) {
                    setForm(f => ({ ...f, participantLimit: num }));
                  }
                }
              }}
              placeholder="No limit"
            />
            <datalist id="limit-suggestions">
              <option value="No limit" />
              <option value="5" />
              <option value="10" />
              <option value="15" />
              <option value="20" />
              <option value="25" />
              <option value="30" />
            </datalist>
            {typeof form.participantLimit === 'number' && (
              <p className="text-xs text-light/50 mt-1">
                Maximum {form.participantLimit} participants. Others will be on standby.
              </p>
            )}
          </div>
        </div>

        {/* Date, Time, Occurrence - Compact Row */}
        <div className="grid grid-cols-4 gap-4">
          <label className="block">
            <div className="text-sm font-medium text-light/80 mb-1">Date *</div>
            <input
              type="date"
              value={form.date}
              onChange={update('date')}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-light/80 mb-1">Time</div>
            <input
              type="time"
              value={form.time}
              onChange={update('time')}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </label>

          <label className="block col-span-2">
            <div className="text-sm font-medium text-light/80 mb-1">Occurrence</div>
            <select
              value={form.occurrence}
              onChange={(e) => {
                const value = e.target.value;
                setForm(f => ({ ...f, occurrence: value }));
                setShowRecurrenceConfig(value !== 'once');
                if (value === 'once') {
                  setSelectedWeekdays([]);
                }
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="once" className="bg-mid-dark text-light">Once</option>
              <option value="daily" className="bg-mid-dark text-light">Daily</option>
              <option value="weekly" className="bg-mid-dark text-light">Weekly</option>
              <option value="monthly" className="bg-mid-dark text-light">Monthly</option>
            </select>
          </label>
        </div>

        {/* Advanced Recurrence Configuration */}
        {showRecurrenceConfig && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h3 className="text-light font-medium mb-3">
              {form.occurrence === 'daily' && '📅 Select Days'}
              {form.occurrence === 'weekly' && '📅 Select Days of Week'}
              {form.occurrence === 'monthly' && '📅 Monthly Pattern'}
            </h3>

            {/* Daily/Weekly: Weekday Selection */}
            {(form.occurrence === 'daily' || form.occurrence === 'weekly') && (
              <div className="flex flex-wrap gap-2">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedWeekdays.includes(day)
                        ? 'bg-primary text-white ring-2 ring-primary'
                        : 'bg-white/10 text-light/70 hover:bg-white/15'
                    }`}
                  >
                    {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                  </button>
                ))}
              </div>
            )}

            {/* Monthly: Pattern Selection */}
            {form.occurrence === 'monthly' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="monthlyPattern"
                    value="date"
                    checked={monthlyPattern === 'date'}
                    onChange={(e) => {
                      setMonthlyPattern('date');
                      setForm(f => ({
                        ...f,
                        recurrenceConfig: { ...f.recurrenceConfig, monthlyPattern: 'date' }
                      }));
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-light/80 text-sm">On the same date each month</span>
                </label>

                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="monthlyPattern"
                    value="pattern"
                    checked={monthlyPattern === 'pattern'}
                    onChange={(e) => {
                      setMonthlyPattern('pattern');
                      setForm(f => ({
                        ...f,
                        recurrenceConfig: { ...f.recurrenceConfig, monthlyPattern: 'pattern' }
                      }));
                    }}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <span className="text-light/80 text-sm">On the:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={monthlyWeek}
                        onChange={(e) => {
                          setMonthlyWeek(e.target.value);
                          setForm(f => ({
                            ...f,
                            recurrenceConfig: { ...f.recurrenceConfig, monthlyWeek: e.target.value }
                          }));
                        }}
                        disabled={monthlyPattern !== 'pattern'}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                      >
                        <option value="first" className="bg-mid-dark text-light">First</option>
                        <option value="second" className="bg-mid-dark text-light">Second</option>
                        <option value="third" className="bg-mid-dark text-light">Third</option>
                        <option value="fourth" className="bg-mid-dark text-light">Fourth</option>
                        <option value="last" className="bg-mid-dark text-light">Last</option>
                      </select>
                      
                      <select
                        value={monthlyDay}
                        onChange={(e) => {
                          setMonthlyDay(e.target.value);
                          setForm(f => ({
                            ...f,
                            recurrenceConfig: { ...f.recurrenceConfig, monthlyDay: e.target.value }
                          }));
                        }}
                        disabled={monthlyPattern !== 'pattern'}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                      >
                        <option value="monday" className="bg-mid-dark text-light">Monday</option>
                        <option value="tuesday" className="bg-mid-dark text-light">Tuesday</option>
                        <option value="wednesday" className="bg-mid-dark text-light">Wednesday</option>
                        <option value="thursday" className="bg-mid-dark text-light">Thursday</option>
                        <option value="friday" className="bg-mid-dark text-light">Friday</option>
                        <option value="saturday" className="bg-mid-dark text-light">Saturday</option>
                        <option value="sunday" className="bg-mid-dark text-light">Sunday</option>
                      </select>
                    </div>
                    {monthlyPattern === 'pattern' && (
                      <p className="text-xs text-light/50 italic">
                        Example: "{monthlyWeek} {monthlyDay} of every month"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Location */}
        <div>
          <label className="block font-medium text-light/80 mb-1">Location</label>
          <input
            type="text"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={form.location}
            onChange={update('location')}
            placeholder="e.g., Stadium, Training Ground..."
          />
        </div>

        {/* Description */}
        <div>
          <label className="block font-medium text-light/80 mb-1">Description</label>
          <textarea
            rows={3}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={form.description}
            onChange={update('description')}
            placeholder="Add event details, notes, instructions..."
          />
        </div>

        {/* File Attachment */}
        <div>
          <label className="block font-medium text-light/80 mb-1">Attachment (Optional)</label>
          <div className="space-y-2">
            {!attachedFile && !form.attachmentUrl ? (
              <label className="flex items-center justify-center px-4 py-3 bg-white/10 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-white/15 hover:border-primary/50 transition-all">
                <span className="text-light/70 text-sm">📎 Click to attach file (Max 10MB)</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileAttachment}
                  accept="*/*"
                />
              </label>
            ) : (
              <div className="bg-white/10 border border-white/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {filePreview && filePreview.startsWith('data:image') ? (
                      <img src={filePreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-primary/20 rounded flex items-center justify-center text-2xl shrink-0">
                        📄
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-light text-sm font-medium truncate">
                        {attachedFile?.name || form.attachmentName || 'Attached file'}
                      </p>
                      {attachedFile && (
                        <p className="text-light/50 text-xs">
                          {(attachedFile.size / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeAttachment}
                    className="px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-all text-sm ml-2 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving...' : '✨ Save Changes'}
          </button>
          <button
            type="button"
            className="px-6 py-3 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all"
            onClick={() => navigate(`/event/${eventId}`)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
