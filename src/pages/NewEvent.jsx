// src/pages/NewEvent.jsx - ENHANCED VERSION
// 🆕 Added: Start Time + Duration + End Time system
// 🆕 Added: Waitlist notification mode selection
// 🆕 Added: More compact multi-column layout
// ✅ Preserved: All existing functionality

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createEvent, getUserClubs } from '../firebase/firestore';
// Notifications are now handled by Cloud Functions automatically
// import { notifyEventCreated, getNotificationRecipients } from '../utils/notifications';
import { useIsAdmin } from '../hooks/usePermissions';
import { isClubOwner } from '../firebase/privileges';
import TrainingBrowserModal from '../components/TrainingBrowserModal';

export default function NewEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [teams, setTeams] = useState([]);

  // File attachment state
  const [attachedFile, setAttachedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');

  // Training Library attachment state
  const [attachedTrainings, setAttachedTrainings] = useState([]);
  const [showTrainingBrowser, setShowTrainingBrowser] = useState(false);

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
    time: '', // 🔄 Keep for backward compatibility
    startTime: '', // 🆕 NEW: Start time
    duration: 60, // 🆕 NEW: Duration in minutes (default 1 hour)
    endTime: '', // 🆕 NEW: Calculated end time
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
    waitlistNotificationMode: 'one_by_one', // 🆕 NEW: Waitlist notification mode
    attachmentUrl: null,
    attachmentName: null,
    responses: {},
    reminders: []
  });

  // 🆕 NEW: Calculate end time when start time or duration changes
  useEffect(() => {
    if (form.startTime && form.duration) {
      const calculated = calculateEndTime(form.startTime, form.duration);
      setForm(f => ({
        ...f,
        endTime: calculated.time,
        time: form.startTime // Keep 'time' in sync for backward compatibility
      }));
    }
  }, [form.startTime, form.duration]);

  // 🆕 NEW: Calculate end time function
  function calculateEndTime(startTime, durationMinutes) {
    if (!startTime) return { time: '', daysOffset: 0 };

    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;

    const daysOffset = Math.floor(totalMinutes / 1440); // 1440 min = 1 day
    const endMinutesInDay = totalMinutes % 1440;

    const endHours = Math.floor(endMinutesInDay / 60);
    const endMinutes = endMinutesInDay % 60;

    return {
      time: `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`,
      daysOffset
    };
  }

  // Load clubs on mount
  useEffect(() => {
    loadClubs();
  }, []);

  // Pre-fill date and time from URL parameters (from Week/Day view)
  useEffect(() => {
    const dateParam = searchParams.get('date');
    const timeParam = searchParams.get('time');

    if (dateParam || timeParam) {
      setForm(f => ({
        ...f,
        ...(dateParam && { date: dateParam }),
        ...(timeParam && { time: timeParam, startTime: timeParam }) // 🔄 Set both for compatibility
      }));
    }
  }, [searchParams]);

  async function loadClubs() {
    try {
      const userClubs = await getUserClubs(user.id);
      setClubs(userClubs);

      if (userClubs.length > 0) {
        const allTeams = [];
        userClubs.forEach(club => {
          if (club.teams) {
            club.teams.forEach(team => {
              allTeams.push({
                ...team,
                clubId: club.id,
                clubName: club.name
              });
            });
          }
        });
        setTeams(allTeams);
      }
    } catch (error) {
      console.error('Error loading clubs:', error);
    }
  }

  const isUserAdmin = useIsAdmin();

  const clubsWhereTrainerOrAssistant = clubs.filter(c =>
    (c.trainers || []).includes(user?.id) ||
    (c.assistants || []).includes(user?.id)
  );

  const canCreateTeamEvents = user && (
    isUserAdmin ||
    user.role === 'trainer' ||
    user.role === 'assistant' ||
    clubsWhereTrainerOrAssistant.length > 0
  );

  const canCreateClubEvents = user && (
    isUserAdmin ||
    clubs.some(c => isClubOwner(c.id))
  );

  useEffect(() => {
    if (!canCreateTeamEvents && !canCreateClubEvents) {
      setForm(f => ({ ...f, visibilityLevel: 'personal' }));
    } else if (canCreateTeamEvents && !canCreateClubEvents) {
      setForm(f => ({ ...f, visibilityLevel: 'team' }));
    }
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

    // 🔄 Build event data with both old and new time formats for compatibility
    const eventData = {
      title: form.title,
      type: form.type === 'custom' ? form.customType.trim() : form.type,
      date: form.date,
      time: form.startTime || form.time, // 🔄 Use startTime if available, fallback to time
      startTime: form.startTime || form.time, // 🆕 NEW
      duration: form.duration, // 🆕 NEW
      endTime: form.endTime, // 🆕 NEW
      occurrence: form.occurrence,
      recurrenceConfig: form.recurrenceConfig,
      location: form.location,
      visibilityLevel: form.visibilityLevel,
      description: form.description,
      participantLimit: form.participantLimit || null,
      waitlistNotificationMode: form.waitlistNotificationMode, // 🆕 NEW
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

    // Add attached trainings
    if (attachedTrainings.length > 0) {
      eventData.attachedTrainings = attachedTrainings.map(training => ({
        id: training.id,
        title: training.title,
        description: training.description || '',
        categories: training.categories || [],
        pictures: training.pictures || [],
        ownerId: training.ownerId,
        attachedAt: new Date().toISOString()
      }));
    }

    try {
      setLoading(true);
      const newEvent = await createEvent(eventData);
      showToast('Event created successfully!', 'success');

      // Notifications are now handled automatically by Cloud Functions (onEventCreated)
      // No need to manually send notifications here

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
    setForm(f => ({
      ...f,
      attachmentUrl: null,
      attachmentName: null
    }));
  }

  // Reminder functions
  function addPresetReminder(minutes) {
    if (reminders.length >= 5) {
      showToast('Maximum 5 reminders allowed', 'error');
      return;
    }

    const newReminder = {
      id: Date.now(),
      minutesBefore: minutes
    };

    setReminders([...reminders, newReminder]);
  }

  function addCustomReminder() {
    const hours = parseInt(customReminderHours) || 0;
    const minutes = parseInt(customReminderMinutes) || 0;
    const totalMinutes = (hours * 60) + minutes;

    if (totalMinutes <= 0) {
      showToast('Please enter a valid reminder time', 'error');
      return;
    }

    if (reminders.length >= 5) {
      showToast('Maximum 5 reminders allowed', 'error');
      return;
    }

    const newReminder = {
      id: Date.now(),
      minutesBefore: totalMinutes
    };

    setReminders([...reminders, newReminder]);
    setCustomReminderHours('');
    setCustomReminderMinutes('');
    setShowReminderConfig(false);
  }

  function removeReminder(id) {
    setReminders(reminders.filter(r => r.id !== id));
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="font-title text-2xl md:text-3xl text-light mb-4 md:mb-6 flex items-center gap-3">
        <span className="w-1 h-6 md:h-8 bg-primary rounded"></span>
        Create Event
      </h1>

      {/* 🎨 ENHANCED: More compact form with optimized spacing */}
      <form onSubmit={handleSubmit} className="space-y-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6 shadow-2xl">

        {/* Title - Full Width */}
        <div>
          <label className="block text-sm font-medium text-light/80 mb-1">Title *</label>
          <input
            type="text"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            value={form.title}
            onChange={update('title')}
            required
          />
        </div>

        {/* 🎨 COMPACT ROW: Type + Participant Limit */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-light/80 mb-1">Type</label>
            <input
              type="text"
              list="type-suggestions"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              value={form.type}
              onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
              placeholder="Training"
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

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-light/80 mb-1">Participant Limit</label>
            <input
              type="text"
              list="limit-suggestions"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
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
              <option value="10" />
              <option value="15" />
              <option value="20" />
              <option value="25" />
              <option value="30" />
            </datalist>
          </div>
        </div>

        {/* 🆕 NEW: Waitlist Notification Mode (only show if participant limit is set) */}
        {form.participantLimit && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <label className="block text-sm font-medium text-light/80 mb-2">
              Waitlist Notifications
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="waitlistMode"
                  value="one_by_one"
                  checked={form.waitlistNotificationMode === 'one_by_one'}
                  onChange={(e) => setForm(f => ({ ...f, waitlistNotificationMode: e.target.value }))}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-light">Notify one by one</div>
                  <div className="text-xs text-light/60">First person gets 24h to respond, then next</div>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="waitlistMode"
                  value="all_at_once"
                  checked={form.waitlistNotificationMode === 'all_at_once'}
                  onChange={(e) => setForm(f => ({ ...f, waitlistNotificationMode: e.target.value }))}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-light">Notify all at once</div>
                  <div className="text-xs text-light/60">Everyone on waitlist gets notified - first to respond gets spot</div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* 🎨 COMPACT ROW: Date + Occurrence */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-light/80 mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={update('date')}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-light/80 mb-1">Occurrence</label>
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
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            >
              <option value="once" className="bg-mid-dark">Once</option>
              <option value="daily" className="bg-mid-dark">Daily</option>
              <option value="weekly" className="bg-mid-dark">Weekly</option>
              <option value="monthly" className="bg-mid-dark">Monthly</option>
            </select>
          </div>
        </div>

        {/* 🆕 NEW: Start Time + Duration + End Time (3-column compact layout) */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-light/80 mb-1">Start Time (24h)</label>
            <div className="flex gap-2">
              {/* Hour Dropdown */}
              <select
                value={form.startTime ? form.startTime.split(':')[0] : ''}
                onChange={(e) => {
                  const hour = e.target.value;
                  const minute = form.startTime ? form.startTime.split(':')[1] : '00';
                  setForm(f => ({ ...f, startTime: `${hour}:${minute}` }));
                }}
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              >
                <option value="" className="bg-mid-dark">Hour</option>
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = String(i).padStart(2, '0');
                  return (
                    <option key={hour} value={hour} className="bg-mid-dark">
                      {hour}
                    </option>
                  );
                })}
              </select>
              
              <span className="text-light/50 text-lg self-center">:</span>
              
              {/* Minute Dropdown */}
              <select
                value={form.startTime ? form.startTime.split(':')[1] : '00'}
                onChange={(e) => {
                  const hour = form.startTime ? form.startTime.split(':')[0] : '00';
                  const minute = e.target.value;
                  setForm(f => ({ ...f, startTime: `${hour}:${minute}` }));
                }}
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              >
                <option value="00" className="bg-mid-dark">00</option>
                <option value="15" className="bg-mid-dark">15</option>
                <option value="30" className="bg-mid-dark">30</option>
                <option value="45" className="bg-mid-dark">45</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-light/80 mb-1">Duration</label>
            <select
              value={form.duration}
              onChange={(e) => setForm(f => ({ ...f, duration: parseInt(e.target.value) }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            >
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
              <option value="150">2.5 hours</option>
              <option value="180">3 hours</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-light/80 mb-1">End Time</label>
            <div className="relative">
              <input
                type="time"
                value={form.endTime}
                readOnly
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-light/70 cursor-not-allowed text-sm"
                title="Automatically calculated from start time + duration"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary" title="Auto-calculated">
                ⚡
              </span>
            </div>
          </div>
        </div>

        {/* Recurrence Configuration (collapsible) */}
        {showRecurrenceConfig && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h3 className="text-light text-sm font-medium mb-3">
              {form.occurrence === 'daily' && '📅 Select Days'}
              {form.occurrence === 'weekly' && '📅 Select Days of Week'}
              {form.occurrence === 'monthly' && '📅 Monthly Pattern'}
            </h3>

            {(form.occurrence === 'daily' || form.occurrence === 'weekly') && (
              <div className="flex flex-wrap gap-2">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const newWeekdays = selectedWeekdays.includes(day)
                        ? selectedWeekdays.filter(d => d !== day)
                        : [...selectedWeekdays, day];
                      setSelectedWeekdays(newWeekdays);
                      setForm(f => ({
                        ...f,
                        recurrenceConfig: {
                          ...f.recurrenceConfig,
                          weekdays: newWeekdays
                        }
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedWeekdays.includes(day)
                      ? 'bg-primary text-white'
                      : 'bg-white/10 text-light hover:bg-white/15'
                      }`}
                  >
                    {day.slice(0, 3).toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {form.occurrence === 'monthly' && (
              <div className="space-y-3">
                <select
                  value={monthlyPattern}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMonthlyPattern(value);
                    setForm(f => ({
                      ...f,
                      recurrenceConfig: {
                        ...f.recurrenceConfig,
                        monthlyPattern: value
                      }
                    }));
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light text-sm"
                >
                  <option value="date" className="bg-mid-dark">Same date each month</option>
                  <option value="weekday" className="bg-mid-dark">Same weekday each month</option>
                </select>

                {monthlyPattern === 'weekday' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={monthlyWeek}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMonthlyWeek(value);
                        setForm(f => ({
                          ...f,
                          recurrenceConfig: {
                            ...f.recurrenceConfig,
                            monthlyWeek: value
                          }
                        }));
                      }}
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light text-sm"
                    >
                      <option value="first">First</option>
                      <option value="second">Second</option>
                      <option value="third">Third</option>
                      <option value="fourth">Fourth</option>
                      <option value="last">Last</option>
                    </select>

                    <select
                      value={monthlyDay}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMonthlyDay(value);
                        setForm(f => ({
                          ...f,
                          recurrenceConfig: {
                            ...f.recurrenceConfig,
                            monthlyDay: value
                          }
                        }));
                      }}
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light text-sm"
                    >
                      <option value="monday">Monday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                      <option value="sunday">Sunday</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-light/80 mb-1">Location</label>
          <input
            type="text"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            value={form.location}
            onChange={update('location')}
            placeholder="e.g., Main Stadium, Field 2"
          />
        </div>

        {/* 🎨 COMPACT ROW: Visibility + Team/Club Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-light/80 mb-1">Visibility</label>
            <select
              value={form.visibilityLevel}
              onChange={(e) => {
                const value = e.target.value;
                setForm(f => ({
                  ...f,
                  visibilityLevel: value,
                  ...(value === 'personal' && { clubId: '', teamId: '' })
                }));
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            >
              <option value="personal" className="bg-mid-dark">👤 Personal</option>
              {canCreateTeamEvents && (
                <option value="team" className="bg-mid-dark">👥 Team</option>
              )}
              {canCreateClubEvents && (
                <option value="club" className="bg-mid-dark">🏛️ Club</option>
              )}
            </select>
          </div>

          {/* Team/Club Selection */}
          {form.visibilityLevel === 'team' && (
            <div>
              <label className="block text-sm font-medium text-light/80 mb-1">Team *</label>
              <select
                value={form.teamId}
                onChange={(e) => {
                  const teamId = e.target.value;
                  const team = teams.find(t => t.id === teamId);
                  setForm(f => ({
                    ...f,
                    teamId,
                    clubId: team?.clubId || ''
                  }));
                }}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                required
              >
                <option value="">Select team...</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id} className="bg-mid-dark">
                    {team.name} ({team.clubName})
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.visibilityLevel === 'club' && (
            <div>
              <label className="block text-sm font-medium text-light/80 mb-1">Club *</label>
              <select
                value={form.clubId}
                onChange={update('clubId')}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                required
              >
                <option value="">Select club...</option>
                {clubs.map(club => (
                  <option key={club.id} value={club.id} className="bg-mid-dark">
                    {club.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-light/80 mb-1">Description</label>
          <textarea
            rows={3}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none text-sm"
            value={form.description}
            onChange={update('description')}
            placeholder="Add event details, notes, instructions..."
          />
        </div>

        {/* File Attachment */}
        <div>
          <label className="block text-sm font-medium text-light/80 mb-1">Attachment (Optional)</label>
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

        {/* Training Plans */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-light/80">📚 Training Plans</label>
            <button
              type="button"
              onClick={() => setShowTrainingBrowser(true)}
              className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm transition-all"
            >
              + Add Training
            </button>
          </div>

          {attachedTrainings.length === 0 ? (
            <div className="bg-white/5 border border-dashed border-white/20 rounded-lg p-4 text-center">
              <p className="text-light/50 text-sm">No training plans attached</p>
              <p className="text-light/40 text-xs mt-1">Click "Add Training" to select from your library</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attachedTrainings.map((training, index) => (
                <div
                  key={training.id}
                  className="bg-white/10 border border-white/20 rounded-lg p-3 flex items-center gap-3"
                >
                  {training.pictures && training.pictures[0] ? (
                    <img
                      src={training.pictures[0]}
                      alt={training.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded flex items-center justify-center text-2xl shrink-0">
                      📚
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-light font-medium text-sm truncate">{training.title}</p>
                    {training.description && (
                      <p className="text-light/60 text-xs line-clamp-1">{training.description}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setAttachedTrainings(prev => prev.filter((_, i) => i !== index))}
                    className="px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-all text-sm shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reminder Configuration */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-light/80">⏰ Event Reminders</label>
            <button
              type="button"
              onClick={() => setShowReminderConfig(!showReminderConfig)}
              className="text-sm text-primary hover:text-primary/80 transition-all"
            >
              {showReminderConfig ? 'Cancel' : '+ Add Reminder'}
            </button>
          </div>

          {showReminderConfig && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-3">
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => { addPresetReminder(30); setShowReminderConfig(false); }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-light rounded-lg text-sm transition-all"
                >
                  30 min before
                </button>
                <button
                  type="button"
                  onClick={() => { addPresetReminder(60); setShowReminderConfig(false); }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-light rounded-lg text-sm transition-all"
                >
                  1 hour before
                </button>
                <button
                  type="button"
                  onClick={() => { addPresetReminder(1440); setShowReminderConfig(false); }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-light rounded-lg text-sm transition-all"
                >
                  1 day before
                </button>
              </div>

              <div className="border-t border-white/10 pt-3">
                <p className="text-xs text-light/60 mb-2">Custom reminder:</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Hours"
                    value={customReminderHours}
                    onChange={(e) => setCustomReminderHours(e.target.value)}
                    className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-light text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Minutes"
                    value={customReminderMinutes}
                    onChange={(e) => setCustomReminderMinutes(e.target.value)}
                    className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-light text-sm"
                  />
                  <button
                    type="button"
                    onClick={addCustomReminder}
                    className="px-4 py-1.5 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {reminders.length > 0 && (
            <div className="space-y-2">
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
                    <span className="text-light text-sm">⏰ {timeText} before event</span>
                    <button
                      type="button"
                      onClick={() => removeReminder(reminder.id)}
                      className="text-red-300 hover:text-red-200 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lock Period */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-medium text-light/80">
              <input
                type="checkbox"
                checked={lockEnabled}
                onChange={(e) => setLockEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              🔒 Enable Event Lock Period
            </label>
          </div>

          {lockEnabled && (
            <div className="space-y-3 pl-6">
              <div className="text-xs text-light/60 mb-2">
                Lock event before start time to prevent status changes:
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      value={lockHours}
                      onChange={(e) => setLockHours(e.target.value)}
                      className="w-16 bg-transparent text-light text-center focus:outline-none text-sm"
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
                      className="w-16 bg-transparent text-light text-center focus:outline-none text-sm"
                    />
                    <span className="text-sm text-light/70">minutes</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-light/50">
                Example: 2 hours means event locks 2 hours before start time
              </p>

              <label className="flex items-center gap-2 text-xs text-light/70">
                <input
                  type="checkbox"
                  checked={notifyOnLock}
                  onChange={(e) => setNotifyOnLock(e.target.checked)}
                  className="w-4 h-4"
                />
                Notify participants when event locks
              </label>

              <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-light/60">
                <p className="flex items-center gap-2">
                  <span>🔒</span>
                  Event will lock {lockHours} hour{parseInt(lockHours) !== 1 ? 's' : ''} {lockMinutes} minute{parseInt(lockMinutes) !== 1 ? 's' : ''} before start
                </p>
                <p className="text-xs text-light/60 mt-1">
                  Attendees won't be able to change their status after lock. Trainers can still manage manually.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50 text-sm"
            disabled={loading}
          >
            {loading ? 'Creating...' : '✨ Create Event'}
          </button>
          <button
            type="button"
            className="px-6 py-3 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all text-sm"
            onClick={() => navigate('/calendar')}
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Training Browser Modal */}
      <TrainingBrowserModal
        isOpen={showTrainingBrowser}
        onClose={() => setShowTrainingBrowser(false)}
        onSelect={(training) => {
          if (!attachedTrainings.find(t => t.id === training.id)) {
            setAttachedTrainings(prev => [...prev, training]);
          }
        }}
      />
    </div>
  );
}

