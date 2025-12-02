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
  const [showCustomLimit, setShowCustomLimit] = useState(false);

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
        type: 'training',
        customType: '',
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
        teamId: '',
        clubId: '',
        visibilityLevel: 'personal',
        createdBy: '',
        description: '',
        participantLimit: null,
        attachmentUrl: null,
        attachmentName: null,
        responses: {}
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

    // Custom type validation
    if (form.type === 'custom' && !form.customType.trim()) {
      showToast('Please enter a custom event type', 'error');
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
  title: form.title,
  type: form.type === 'custom' ? form.customType.trim() : form.type,
  date: form.date,
  time: form.time,
  occurrence: form.occurrence,
  recurrenceConfig: form.recurrenceConfig,
  location: form.location,
  visibilityLevel: form.visibilityLevel,
  description: form.description,
  participantLimit: form.participantLimit || null,
  createdBy: user.id,
  responses: {}
};

// Add optional fields only if they exist
if (form.teamId) eventData.teamId = form.teamId;
if (form.clubId) eventData.clubId = form.clubId;
if (form.attachmentUrl) {
  eventData.attachmentUrl = form.attachmentUrl;
  eventData.attachmentName = form.attachmentName;
}

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
  
  // ========== END OF NEW FUNCTIONS ==========

return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="font-title text-3xl text-light mb-6 flex items-center gap-3">
        <span className="w-1 h-8 bg-primary rounded"></span>
        Create Event
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 shadow-2xl">
        <div>
          <label className="block font-medium text-light/80 mb-1">Title *</label>
          <input
            type="text"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={form.title}
            onChange={update('title')}
            // placeholder="e.g., Big Football Match"
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
          </div>
        </div>

        {form.type === 'custom' && (
          <div>
            <label className="block font-medium text-light/80 mb-1">Custom Event Type *</label>
            <input
              type="text"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              value={form.customType}
              onChange={update('customType')}
              placeholder="e.g., RaceCar Test, Photo Session, BBQ..."
              required
            />
          </div>
        )}

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

        {/* Visibility Level Selector - Compact */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-medium text-light/80 mb-1">Visibility</label>
            <select
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              value={form.visibilityLevel}
              onChange={(e) => {
                const level = e.target.value;
                if (level === 'personal') {
                  setForm(f => ({ ...f, visibilityLevel: level, teamId: '', clubId: '' }));
                } else if (level === 'team') {
                  setForm(f => ({ ...f, visibilityLevel: level, clubId: '' }));
                } else if (level === 'club') {
                  setForm(f => ({ ...f, visibilityLevel: level, teamId: '' }));
                }
              }}
            >
              <option value="personal" className="bg-mid-dark text-light">👤 Personal</option>
              {canCreateTeamEvents && (
                <option value="team" className="bg-mid-dark text-light">👥 Team</option>
              )}
              {canCreateClubEvents && (
                <option value="club" className="bg-mid-dark text-light">🏛️ Club</option>
              )}
            </select>
          </div>

          {/* Team Selector - Compact */}
          {form.visibilityLevel === 'team' && (
            <div className="col-span-2">
              <label className="block font-medium text-light/80 mb-1">Team *</label>
              <select
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                value={form.teamId}
                onChange={(e) => {
                  const teamId = e.target.value;
                  setForm(f => ({ ...f, teamId }));
                  const team = teams.find(t => t.id === teamId);
                  if (team) {
                    setForm(f => ({ ...f, clubId: team.clubId }));
                  }
                }}
                required
              >
                <option value="" className="bg-mid-dark text-light">-- choose team --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-mid-dark text-light">
                    {t.displayName || t.name}
                  </option>
                ))}
              </select>
              {teams.length === 0 && (
                <p className="text-xs text-light/50 mt-1">No teams available</p>
              )}
            </div>
          )}

          {/* Club Selector - Compact */}
          {form.visibilityLevel === 'club' && canCreateClubEvents && (
            <div className="col-span-2">
              <label className="block font-medium text-light/80 mb-1">Club *</label>
              <select
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                value={form.clubId}
                onChange={update('clubId')}
                required
              >
                <option value="" className="bg-mid-dark text-light">-- choose club --</option>
                {ownedClubs.map((c) => (
                  <option key={c.id} value={c.id} className="bg-mid-dark text-light">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

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
            {!attachedFile ? (
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
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-primary/20 rounded flex items-center justify-center text-2xl shrink-0">
                        📄
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-light text-sm font-medium truncate">{attachedFile.name}</p>
                      <p className="text-light/50 text-xs">
                        {(attachedFile.size / 1024).toFixed(1)} KB
                      </p>
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

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Creating...' : '✨ Create Event'}
          </button>
          <button
            type="button"
            className="px-6 py-3 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all"
            onClick={() => navigate('/calendar')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

