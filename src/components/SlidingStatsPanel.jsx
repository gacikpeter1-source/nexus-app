// src/components/SlidingStatsPanel.jsx
import { useState, useEffect } from 'react';

export default function SlidingStatsPanel({ 
  member,
  statsTemplate,
  teamMemberData,
  onClose 
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation
    setTimeout(() => setIsOpen(true), 10);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300); // Wait for animation
  };

  // Get stat value with fallback
  const getStatValue = (fieldId) => {
    return teamMemberData?.stats?.[fieldId] || 
           teamMemberData?.[fieldId] || 
           member?.stats?.[fieldId] || 
           '-';
  };

  // Format value based on type
  const formatValue = (value, type) => {
    if (value === '-' || value === null || value === undefined) return '-';
    
    switch (type) {
      case 'currency':
        return `$${parseFloat(value).toFixed(1)}M`;
      case 'number':
        return parseFloat(value).toFixed(0);
      default:
        return value;
    }
  };

  // Render field based on type
  const renderField = (field, sectionId) => {
    if (!field.enabled) return null;
    
    const value = getStatValue(field.id);

    switch (field.type) {
      case 'bar':
        // Progress bar with value
        const maxValue = 200; // Configurable max
        const percentage = Math.min((parseFloat(value) / maxValue) * 100, 100);
        
        return (
          <div key={field.id} className="mb-3">
            <div className="flex items-center justify-between text-xs text-light/70 mb-1">
              <span>{field.label}</span>
              <span className="font-bold">{value}</span>
            </div>
            <div className="h-6 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-500"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: field.color || '#3b82f6'
                }}
              />
            </div>
          </div>
        );

      default:
        // Regular field
        return (
          <div key={field.id} className="flex items-center justify-between py-1 text-sm">
            <span className="text-light/70">{field.label}:</span>
            <span className="text-light font-semibold">{formatValue(value, field.type)}</span>
          </div>
        );
    }
  };

  if (!statsTemplate || !statsTemplate.enabled) return null;

  return (
    <>
      {/* Backdrop - covers only the card */}
      <div 
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity duration-300 rounded-2xl ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Sliding Panel - positioned within card */}
      <div 
        className={`absolute left-0 top-0 bottom-0 w-3/5 bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto rounded-l-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-white/20 p-3 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-light text-sm">{member.username}</h3>
              <p className="text-xs text-light/60">Detailed Stats</p>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-light transition text-sm"
            >
              ←
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-4">
          {statsTemplate.sections
            .filter(section => section.enabled)
            .map((section) => (
              <div key={section.id} className="bg-slate-800/50 rounded-lg p-3">
                <h4 className="font-bold text-light text-xs uppercase tracking-wide mb-2 pb-2 border-b border-white/10">
                  {section.name}
                </h4>
                
                <div className="space-y-1">
                  {section.fields.map(field => renderField(field, section.id))}
                </div>

                {section.fields.filter(f => f.enabled).length === 0 && (
                  <p className="text-light/40 text-xs text-center py-2">
                    No fields configured
                  </p>
                )}
              </div>
            ))}

          {statsTemplate.sections.filter(s => s.enabled).length === 0 && (
            <div className="text-center py-8">
              <p className="text-light/60 text-sm">No sections enabled</p>
              <p className="text-light/40 text-xs mt-1">Ask a trainer to configure stats</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}