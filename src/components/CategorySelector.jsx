// src/components/CategorySelector.jsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Default categories
export const DEFAULT_CATEGORIES = [
  { id: 'agility', name: 'Agility', icon: '🏃' },
  { id: 'strength', name: 'Strength', icon: '💪' },
  { id: 'power', name: 'Power', icon: '⚡' },
  { id: 'endurance', name: 'Endurance', icon: '🏃‍♂️' },
  { id: 'burning-fat', name: 'Burning Fat', icon: '🔥' },
  { id: 'flexibility', name: 'Flexibility', icon: '🤸' },
  { id: 'speed', name: 'Speed', icon: '💨' },
  { id: 'technical', name: 'Technical Skills', icon: '⚽' },
  { id: 'tactical', name: 'Tactical Training', icon: '🎯' },
  { id: 'conditioning', name: 'Conditioning', icon: '💯' }
];

export default function CategorySelector({ selectedCategories, onChange, required = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Calculate dropdown position
  function calculatePosition() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowCustomInput(false);
      }
      if (buttonRef.current && !buttonRef.current.contains(event.target)) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false);
          setShowCustomInput(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toggle category
  function toggleCategory(categoryId) {
    if (selectedCategories.includes(categoryId)) {
      onChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      onChange([...selectedCategories, categoryId]);
    }
  }

  // Add custom category
  function handleAddCustom() {
    if (!customCategory.trim()) return;
    
    const customId = customCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!selectedCategories.includes(customId)) {
      onChange([...selectedCategories, customId]);
    }
    setCustomCategory('');
    setShowCustomInput(false);
  }

  // Get category display name
  function getCategoryDisplay(categoryId) {
    const defaultCat = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
    if (defaultCat) {
      return `${defaultCat.icon} ${defaultCat.name}`;
    }
    // Custom category - capitalize first letter of each word
    return `✨ ${categoryId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`;
  }

  // Remove category chip
  function removeCategory(categoryId) {
    onChange(selectedCategories.filter(id => id !== categoryId));
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Label */}
      <label className="block text-sm font-medium text-light/80 mb-2">
        Categories {required && <span className="text-red-400">*</span>}
      </label>
      
      {/* Dropdown Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          calculatePosition();
          setIsOpen(!isOpen);
        }}
        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-left text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all flex items-center justify-between"
      >
        <span className="text-sm">
          {selectedCategories.length === 0 
            ? 'Select categories...' 
            : `${selectedCategories.length} selected`}
        </span>
        <span className="text-light/60">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Selected Categories (Chips) */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedCategories.map(catId => (
            <div
              key={catId}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 text-primary rounded-full text-sm"
            >
              <span>{getCategoryDisplay(catId)}</span>
              <button
                type="button"
                onClick={() => removeCategory(catId)}
                className="hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown Menu - Using Portal */}
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 9999
          }}
          className="bg-mid-dark border border-white/20 rounded-lg shadow-xl max-h-72 overflow-y-auto"
        >
          {/* Default Categories */}
          <div className="p-2">
            {DEFAULT_CATEGORIES.map(category => (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-all text-left"
              >
                <div className={`w-5 h-5 border-2 rounded flex items-center justify-center shrink-0 ${
                  selectedCategories.includes(category.id)
                    ? 'bg-primary border-primary'
                    : 'border-white/30'
                }`}>
                  {selectedCategories.includes(category.id) && (
                    <span className="text-white text-xs">✓</span>
                  )}
                </div>
                <span className="text-xl">{category.icon}</span>
                <span className="text-sm text-light">{category.name}</span>
              </button>
            ))}
          </div>

          {/* Custom Category Section */}
          <div className="border-t border-white/10 p-2">
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-all text-left text-primary"
              >
                <span className="text-xl">➕</span>
                <span className="text-sm font-medium">Add Custom Category</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCustom()}
                  placeholder="Enter category name..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCustom}
                  className="px-3 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm transition-all"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomCategory('');
                  }}
                  className="px-3 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg text-sm transition-all"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {required && selectedCategories.length === 0 && (
        <p className="text-xs text-red-400 mt-1">Please select at least one category</p>
      )}
    </div>
  );
}

