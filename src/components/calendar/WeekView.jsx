// src/components/calendar/WeekView.jsx
import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';

export default function WeekView({ events, user }) {
  const navigate = useNavigate();
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Generate array of hours (00:00 - 23:00)
  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i);
  }, []);

  // Get start of current week (Sunday)
  const startOfWeek = useMemo(() => {
    const date = new Date(currentWeek);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date;
  }, [currentWeek]);

  // Generate 7 days (Sunday - Saturday)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      return date;
    });
  }, [startOfWeek]);

  // Get events for a specific day
  const getEventsForDay = (date) => {
    // Format date in local timezone (avoid UTC conversion issues)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return events.filter(e => e.date === dateStr);
  };

  // Navigate to previous week
  const previousWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  };

  // Navigate to next week
  const nextWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeek(newDate);
  };

  // Navigate to today
  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  // Handle empty slot click
  const handleSlotClick = (date, hour) => {
    // Format date in local timezone (avoid UTC conversion issues)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
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

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
      {/* Week Navigation */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button
          onClick={previousWeek}
          className="px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg transition-all"
        >
          ← Previous
        </button>
        
        <div className="flex items-center gap-3">
          <h2 className="font-title text-xl text-light">
            Week {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h2>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-all"
          >
            Today
          </button>
        </div>
        
        <button
          onClick={nextWeek}
          className="px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg transition-all"
        >
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-auto max-h-[70vh]">
        <div className="inline-block min-w-full">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-white/10 sticky top-0 bg-mid-dark z-10">
            {/* Empty corner for time column */}
            <div className="p-3 border-r border-white/10" />
            
            {/* Day headers */}
            {weekDays.map((day, idx) => {
              const isToday = day.toDateString() === today.toDateString();
              return (
                <div
                  key={idx}
                  className={`p-3 text-center border-r border-white/10 last:border-r-0 ${
                    isToday ? 'bg-primary/20' : ''
                  }`}
                >
                  <div className={`font-medium text-sm ${isToday ? 'text-primary' : 'text-light/80'}`}>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? 'text-primary' : 'text-light'}`}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time slots */}
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-white/10 last:border-b-0">
                {/* Time label */}
                <div className="p-2 text-right text-xs text-light/60 border-r border-white/10 h-16">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                
                {/* Day columns */}
                {weekDays.map((day, dayIdx) => {
                  const dayEvents = getEventsForDay(day).filter(e => {
                    if (!e.time) return false;
                    const [eventHour] = e.time.split(':').map(Number);
                    return eventHour === hour;
                  });

                  return (
                    <div
                      key={dayIdx}
                      className="relative border-r border-white/10 last:border-r-0 h-16 hover:bg-white/5 transition-all cursor-pointer overflow-hidden"
                      onClick={() => handleSlotClick(day, hour)}
                    >
                      {/* Events in this slot */}
                      {dayEvents.length > 0 && (
                        <div className="absolute inset-0 p-0.5 overflow-hidden">
                          {dayEvents.map((event) => {
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
                                className={`block w-full rounded px-2 py-1 mb-0.5 text-white text-xs overflow-hidden transition-all ${
                                  isAttending 
                                    ? 'bg-green-500 border-2 border-green-300 shadow-[0_0_8px_rgba(34,197,94,0.6)] hover:shadow-[0_0_12px_rgba(34,197,94,0.8)]' 
                                    : `${getEventColor(event.type)} hover:opacity-90`
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="font-semibold truncate">
                                    {isAttending && '✓ '}{event.time}
                                  </div>
                                  <div className={`shrink-0 font-bold text-[10px] px-1 rounded ${
                                    isFull ? 'bg-red-600/80' : 'bg-black/30'
                                  }`}>
                                    {attendingCount}/{totalLimit}
                                  </div>
                                </div>
                                <div className="truncate">{event.title}</div>
                                {event.location && (
                                  <div className="text-[10px] opacity-75 truncate">📍 {event.location}</div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

