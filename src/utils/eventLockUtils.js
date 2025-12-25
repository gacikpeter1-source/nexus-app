// src/utils/eventLockUtils.js
// Utility functions for event lock period

/**
 * Check if an event is currently in lock period
 * @param {Object} event - Event object with date, time, and lockPeriod
 * @returns {boolean} - True if event is locked
 */
export const isEventLocked = (event) => {
  if (!event || !event.lockPeriod || !event.lockPeriod.enabled) {
    return false;
  }

  if (!event.date || !event.time) {
    return false;
  }

  try {
    // Parse event start time
    const eventDate = new Date(event.date);
    const [hours, minutes] = event.time.split(':');
    eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const eventStartTime = eventDate.getTime();
    const now = Date.now();

    // Calculate lock start time
    const lockStartTime = eventStartTime - (event.lockPeriod.minutesBefore * 60 * 1000);

    // Event is locked if current time is between lock start and event start
    return now >= lockStartTime && now < eventStartTime;
  } catch (error) {
    console.error('Error checking if event is locked:', error);
    return false;
  }
};

/**
 * Get formatted lock time text
 * @param {Object} event - Event object with lockPeriod
 * @returns {string} - Formatted text like "2 hours" or "1 hour 30 minutes"
 */
export const getLockTimeText = (event) => {
  if (!event || !event.lockPeriod || !event.lockPeriod.enabled) {
    return '';
  }

  const totalMinutes = event.lockPeriod.minutesBefore;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
};

/**
 * Get time remaining until lock starts
 * @param {Object} event - Event object with date, time, and lockPeriod
 * @returns {Object|null} - { hours, minutes, seconds } or null if not applicable
 */
export const getTimeUntilLock = (event) => {
  if (!event || !event.lockPeriod || !event.lockPeriod.enabled) {
    return null;
  }

  if (!event.date || !event.time) {
    return null;
  }

  try {
    const eventDate = new Date(event.date);
    const [hours, minutes] = event.time.split(':');
    eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const eventStartTime = eventDate.getTime();
    const lockStartTime = eventStartTime - (event.lockPeriod.minutesBefore * 60 * 1000);
    const now = Date.now();

    // If already locked or event started, return null
    if (now >= lockStartTime) {
      return null;
    }

    const timeUntilLock = lockStartTime - now;
    const totalSeconds = Math.floor(timeUntilLock / 1000);
    
    return {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };
  } catch (error) {
    console.error('Error calculating time until lock:', error);
    return null;
  }
};

/**
 * Check if event has available spots
 * @param {Object} event - Event object
 * @returns {boolean} - True if there are free spots
 */
export const hasAvailableSpots = (event) => {
  if (!event || !event.participantLimit) {
    return true; // No limit means always available
  }

  const responses = event.responses || {};
  const attendingCount = Object.values(responses).filter(r => r.status === 'attending').length;
  
  return attendingCount < event.participantLimit;
};

/**
 * Check if user can change event status (considering lock period, available spots, and role)
 * @param {Object} event - Event object
 * @param {Object} user - Current user object
 * @param {boolean} isTrainer - Whether user is trainer/admin
 * @param {string} newStatus - The new status user wants to change to (optional)
 * @returns {Object} - { canChange: boolean, reason: string }
 */
export const canChangeEventStatus = (event, user, isTrainer = false, newStatus = null) => {
  // Trainers can always manage events (including past events)
  if (isTrainer) {
    return { canChange: true, reason: '' };
  }

  // Event creator can always manage
  if (event.createdBy === user?.id) {
    return { canChange: true, reason: '' };
  }

  // ✅ Check if event is in the past (regular users cannot change status)
  if (event && event.date && event.time) {
    try {
      const eventDateTime = new Date(`${event.date}T${event.time}`);
      const now = new Date();
      
      if (eventDateTime < now) {
        return { 
          canChange: false, 
          reason: 'Event has already ended. Status changes are not allowed.' 
        };
      }
    } catch (error) {
      console.error('Error checking if event is past:', error);
    }
  }

  // ✅ ENHANCED LOCK LOGIC: Check if event is locked
  if (isEventLocked(event)) {
    const currentStatus = event.responses?.[user?.id]?.status;
    
    // ✅ Enhancement: If user wants to ATTEND and there are free spots, allow it
    if (newStatus === 'attending' && hasAvailableSpots(event)) {
      return { 
        canChange: true, 
        reason: '' 
      };
    }
    
    // ✅ Block cancellations: If user is currently attending and wants to change, block it
    if (currentStatus === 'attending' && newStatus && newStatus !== 'attending') {
      return { 
        canChange: false, 
        reason: 'Event is locked. You cannot cancel your attendance during the lock period.' 
      };
    }
    
    // ✅ Block if trying to attend but event is full
    if (newStatus === 'attending' && !hasAvailableSpots(event)) {
      return { 
        canChange: false, 
        reason: 'Event is locked and all spots are filled. You cannot join at this time.' 
      };
    }
    
    // ✅ Block other status changes (maybe, declined, etc.) during lock
    if (newStatus && newStatus !== 'attending') {
      return { 
        canChange: false, 
        reason: 'Event is locked. Status changes are not allowed during the lock period.' 
      };
    }
    
    // Default block if no specific status provided
    return { 
      canChange: false, 
      reason: 'Event is locked. Status changes are not allowed.' 
    };
  }

  return { canChange: true, reason: '' };
};

