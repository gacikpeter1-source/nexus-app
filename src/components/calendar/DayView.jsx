// src/components/calendar/DayView.jsx
import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';

export default function DayView({ events, user }) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Generate array of hours (00:00 - 23:00)
  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i);
  }, []);

  // Get events for current day
  const dayEvents = useMemo(() => {
    // Format date in local timezone (avoid UTC conversion issues)
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return events.filter(e => e.date === dateStr);
  }, [events, currentDate]);

  // Get events for a specific hour
  const getEventsForHour = (hour) => {
    return dayEvents.filter(e => {
      if (!e.time) return false;
      const [eventHour] = e.time.split(':').map(Number);
      return eventHour === hour;
    });
  };

  // Navigate to previous day
  const previousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  // Navigate to next day
  const nextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  // Navigate to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Handle empty slot click
  const handleSlotClick = (hour) => {
    // Format date in local timezone (avoid UTC conversion issues)
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    navigate(`/new-event?date=${dateStr}&time=${timeStr}`);
  };

  // Get event color based on type
  const getEventColor = (type) => {
    switch(type) {
      case 'training': return 'bg-blue-500';
      case 'game':
      case 'match': return 'bg-green-500';
      case 'tournament': return 'bg-purple-500';
      case 'meeting': return 'bg-yellow-500';
      case 'social': return 'bg-pink-500';
      default: return 'bg-primary';
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = currentDate.toDateString() === today.toDateString();

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
      {/* Day Navigation */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button
          onClick={previousDay}
          className="px-3 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg transition-all text-sm"
        >
          ←
        </button>
        
        <div className="flex flex-col items-center gap-1">
          <h2 className={`font-title text-xl ${isToday ? 'text-primary' : 'text-light'}`}>
            {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
          </h2>
          <div className="text-light/60 text-sm">
            {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          {isToday && (
            <div className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
              Today
            </div>
          )}
        </div>
        
        <button
          onClick={nextDay}
          className="px-3 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg transition-all text-sm"
        >
          →
        </button>
      </div>

      {/* Quick Today Button */}
      {!isToday && (
        <div className="px-4 py-2 border-b border-white/10">
          <button
            onClick={goToToday}
            className="w-full px-3 py-2 text-sm bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-all"
          >
            Go to Today
          </button>
        </div>
      )}

      {/* Time slots */}
      <div className="overflow-auto max-h-[65vh]">
        <div className="p-2 space-y-1">
          {hours.map((hour) => {
            const hourEvents = getEventsForHour(hour);
            
            return (
              <div
                key={hour}
                className="flex gap-2 min-h-[4rem] border-b border-white/10 last:border-b-0"
              >
                {/* Time label */}
                <div className="w-16 shrink-0 text-right pt-2">
                  <div className="text-sm font-medium text-light/80">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                </div>
                
                {/* Event area */}
                <div 
                  className="flex-1 min-h-[4rem] hover:bg-white/5 rounded-lg transition-all cursor-pointer relative p-1"
                  onClick={() => handleSlotClick(hour)}
                >
                  {hourEvents.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-light/20 text-xs">
                      + Add event
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {hourEvents.map((event) => {
                        const userResponse = event.responses?.[user?.id];
                        const isAttending = userResponse?.status === 'attending';
                        const attendingCount = event.responses 
                          ? Object.values(event.responses).filter(r => r.status === 'attending').length 
                          : 0;
                        const totalLimit = event.participantLimit || '∞';
                        const isFull = event.participantLimit && attendingCount >= event.participantLimit;
                        
                        return (
                          <Link
                            key={event.id}
                            to={`/event/${event.id}`}
                            className={`block rounded-lg px-3 py-2 text-white transition-all ${
                              isAttending 
                                ? 'bg-green-500 border-2 border-green-300 shadow-[0_0_10px_rgba(34,197,94,0.6)] hover:shadow-[0_0_15px_rgba(34,197,94,0.8)]' 
                                : `${getEventColor(event.type)} hover:opacity-90`
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="font-semibold text-sm truncate">
                                {isAttending && '✓ '}{event.time} - {event.title}
                              </div>
                              <div className={`shrink-0 px-2 py-0.5 rounded font-bold text-xs ${
                                isFull ? 'bg-red-600/90 text-white' : 'bg-black/40'
                              }`}>
                                {attendingCount}/{totalLimit}
                              </div>
                            </div>
                            {isAttending && (
                              <div className="text-xs font-medium bg-green-600/50 px-2 py-0.5 rounded inline-block mb-1">
                                You are registered
                              </div>
                            )}
                            {event.location && (
                              <div className="text-xs opacity-90">📍 {event.location}</div>
                            )}
                            {event.type && (
                              <div className="text-xs opacity-75 capitalize mt-1">
                                {event.type}
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

