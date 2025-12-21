// src/pages/NewEvent.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createEvent, getUserClubs } from '../firebase/firestore';
import { notifyEventCreated, getNotificationRecipients } from '../utils/notifications';
import { useIsAdmin } from '../hooks/usePermissions';
import { isClubOwner } from '../firebase/privileges';

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

  // Reminder state
  const [reminders, setReminders] = useState([]);
  const [showReminderConfig, setShowReminderConfig] = useState(false);
  const [customReminderHours, setCustomReminderHours] = useState('');
  const [customReminderMinutes, setCustomReminderMinutes] = useState('');

  // Lock period state
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockHours, setLockHours] = useState('2');
  const [lockMinutes, setLockMinutes] = useState('0');
  const [notifyOnLock, setNotifyOnLock] = useState(false);

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
        responses: {},
        reminders: []
});

  // Load clubs on mount
  useEffect(() => {
    loadClubs();
  }, []);

  async function loadClubs() {
    try {
      // Get only clubs user belongs to
      const userClubs = await getUserClubs(user.id);
      setClubs(userClubs);

      // Extract teams from user's clubs
      const allTeams = [];
      userClubs.forEach(club => {
        const clubTeams = club.teams || [];
        clubTeams.forEach(team => {
          allTeams.push({
            ...team,
            clubId: club.id,
            clubName: club.name,
            displayName: `${team.name} (${club.name})`
          });
        });
      });

      setTeams(allTeams);
    } catch (error) {
      console.error('Error loading clubs:', error);
      showToast('Failed to load clubs', 'error');
    }
  }

  // Get clubs that user owns (SuperTrainer only)
  // 🔒 NEW PERMISSION SYSTEM: Check event creation permissions
  const isUserAdmin = useIsAdmin();
  
  const ownedClubs = clubs.filter(c => isClubOwner(user, c.id));

  // Get clubs where user is trainer or assistant
  const clubsWhereTrainerOrAssistant = clubs.filter(c => 
    (c.trainers || []).includes(user?.id) || 
    (c.assistants || []).includes(user?.id)
  );

  // Determine user's role capabilities
  const canCreateTeamEvents = user && (
    isUserAdmin ||
    user.role === 'trainer' || 
    user.role === 'assistant' ||
    clubsWhereTrainerOrAssistant.length > 0
  );
  
  const canCreateClubEvents = user && (
    isUserAdmin || 
    ownedClubs.length > 0 ||
    clubsWhereTrainerOrAssistant.length > 0 // Trainers can create club events too
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
      showToast('Only club owners and trainers can create club-wide events', 'error');
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
  responses: {},
  reminders: reminders,
  lockPeriod: lockEnabled ? {
    enabled: true,
    minutesBefore: (parseInt(lockHours) || 0) * 60 + (parseInt(lockMinutes) || 0),
    notifyOnLock: notifyOnLock
  } : {
    enabled: false,
    minutesBefore: 0,
    notifyOnLock: false
  }
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
        const newEvent = await createEvent(eventData); // ✅ Store returned event
        showToast('Event created successfully!', 'success');
        
        // ✅ Send notification - use form.clubId and form.teamId
        if (form.visibilityLevel !== 'personal') {
          const recipients = await getNotificationRecipients(form.clubId, form.teamId);
          await notifyEventCreated(newEvent, recipients, recipients);
        }
        
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

        {/* Reminder Configuration */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block font-medium text-light/80">⏰ Event Reminders</label>
            <button
              type="button"
              onClick={() => setShowReminderConfig(!showReminderConfig)}
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              {showReminderConfig ? '− Hide' : '+ Add Reminders'}
            </button>
          </div>

          {showReminderConfig && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
              <p className="text-light/60 text-sm">
                Send reminders to attendees before the event starts
              </p>

              {/* Quick Add Buttons */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '24 hours before', value: 24 * 60 },
                  { label: '12 hours before', value: 12 * 60 },
                  { label: '1 hour before', value: 60 },
                  { label: '30 minutes before', value: 30 },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      const exists = reminders.some(r => r.minutesBefore === preset.value);
                      if (!exists) {
                        setReminders([...reminders, {
                          id: Date.now() + Math.random(),
                          minutesBefore: preset.value,
                          channels: { push: true, email: false }
                        }]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      reminders.some(r => r.minutesBefore === preset.value)
                        ? 'bg-primary/30 text-primary border border-primary'
                        : 'bg-white/10 text-light/80 hover:bg-white/15 border border-white/20'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Reminder Input */}
              <div className="border-t border-white/10 pt-3 mt-3">
                <p className="text-light/70 text-sm font-medium mb-2">Or add custom time:</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-light/60 mb-1">Hours</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={customReminderHours}
                      onChange={(e) => setCustomReminderHours(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-light/60 mb-1">Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={customReminderMinutes}
                      onChange={(e) => setCustomReminderMinutes(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const hours = parseInt(customReminderHours) || 0;
                      const minutes = parseInt(customReminderMinutes) || 0;
                      const totalMinutes = (hours * 60) + minutes;
                      
                      if (totalMinutes > 0) {
                        const exists = reminders.some(r => r.minutesBefore === totalMinutes);
                        if (!exists) {
                          setReminders([...reminders, {
                            id: Date.now() + Math.random(),
                            minutesBefore: totalMinutes,
                            channels: { push: true, email: false }
                          }]);
                          setCustomReminderHours('');
                          setCustomReminderMinutes('');
                        } else {
                          showToast('This reminder already exists', 'info');
                        }
                      } else {
                        showToast('Please enter hours or minutes', 'error');
                      }
                    }}
                    className="px-4 py-2 bg-primary/20 text-primary border border-primary rounded-lg hover:bg-primary/30 transition-all text-sm whitespace-nowrap"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Active Reminders List */}
              {reminders.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-light/70 text-sm font-medium">Active Reminders:</p>
                  {reminders.map((reminder) => {
                    const hours = Math.floor(reminder.minutesBefore / 60);
                    const minutes = reminder.minutesBefore % 60;
                    const timeText = hours > 0 
                      ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
                      : `${minutes}m`;

                    return (
                      <div
                        key={reminder.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">⏰</span>
                          <div>
                            <p className="text-light font-medium">{timeText} before event</p>
                            <div className="flex gap-2 mt-1">
                              <label className="flex items-center gap-1 text-xs text-light/70">
                                <input
                                  type="checkbox"
                                  checked={reminder.channels.push}
                                  onChange={(e) => {
                                    setReminders(reminders.map(r =>
                                      r.id === reminder.id
                                        ? { ...r, channels: { ...r.channels, push: e.target.checked } }
                                        : r
                                    ));
                                  }}
                                  className="rounded"
                                />
                                Push
                              </label>
                              <label className="flex items-center gap-1 text-xs text-light/70">
                                <input
                                  type="checkbox"
                                  checked={reminder.channels.email}
                                  onChange={(e) => {
                                    setReminders(reminders.map(r =>
                                      r.id === reminder.id
                                        ? { ...r, channels: { ...r.channels, email: e.target.checked } }
                                        : r
                                    ));
                                  }}
                                  className="rounded"
                                />
                                Email
                              </label>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReminders(reminders.filter(r => r.id !== reminder.id))}
                          className="px-2 py-1 text-red-400 hover:bg-red-500/20 rounded transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {reminders.length === 0 && (
                <p className="text-light/40 text-sm text-center py-3">
                  Click a preset above to add reminders
                </p>
              )}
            </div>
          )}
        </div>

        {/* Lock Period Configuration */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <label className="block font-medium text-light/80">🔒 Lock Period</label>
              <span className="text-xs text-light/50">(Prevent status changes before event)</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lockEnabled}
                onChange={(e) => setLockEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-light/80">Enable</span>
            </label>
          </div>

          {lockEnabled && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
              <p className="text-light/60 text-sm">
                Lock the event before it starts to prevent attendees from changing their status
              </p>

              {/* Lock Time Configuration */}
              <div>
                <label className="block text-sm font-medium text-light/70 mb-2">
                  Lock event before start:
                </label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={lockHours}
                        onChange={(e) => setLockHours(e.target.value)}
                        className="w-16 bg-transparent text-light text-center focus:outline-none"
                      />
                      <span className="text-sm text-light/70">hours</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={lockMinutes}
                        onChange={(e) => setLockMinutes(e.target.value)}
                        className="w-16 bg-transparent text-light text-center focus:outline-none"
                      />
                      <span className="text-sm text-light/70">minutes</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-light/50 mt-2">
                  Example: 2 hours means event locks 2 hours before start time
                </p>
              </div>

              {/* Notify on Lock Toggle */}
              <div className="border-t border-white/10 pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnLock}
                    onChange={(e) => setNotifyOnLock(e.target.checked)}
                    className="rounded"
                  />
                  <div>
                    <span className="text-sm text-light font-medium">Send notification when lock starts</span>
                    <p className="text-xs text-light/50">Notify all attendees when the event becomes locked</p>
                  </div>
                </label>
              </div>

              {/* Lock Preview */}
              {(parseInt(lockHours) > 0 || parseInt(lockMinutes) > 0) && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mt-2">
                  <p className="text-sm text-primary font-medium flex items-center gap-2">
                    <span>🔒</span>
                    Event will lock {lockHours} hour{parseInt(lockHours) !== 1 ? 's' : ''} {lockMinutes} minute{parseInt(lockMinutes) !== 1 ? 's' : ''} before start
                  </p>
                  <p className="text-xs text-light/60 mt-1">
                    Attendees won't be able to change their status after lock. Trainers can still manage manually.
                  </p>
                </div>
              )}
            </div>
          )}
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

