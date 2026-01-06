import React from 'react';

export const DEFAULT_CATEGORIES = [
  { id: 'skills', name: 'Skills', icon: '🎯' },
  { id: 'tactics', name: 'Tactics', icon: '♟️' },
  { id: 'conditioning', name: 'Conditioning', icon: '💪' },
  { id: 'teamwork', name: 'Teamwork', icon: '🤝' },
  { id: 'shooting', name: 'Shooting', icon: '🥅' },
  { id: 'passing', name: 'Passing', icon: '🏒' },
  { id: 'defense', name: 'Defense', icon: '🛡️' },
  { id: 'warmup', name: 'Warm Up', icon: '🔥' },
  { id: 'cooldown', name: 'Cool Down', icon: '❄️' },
];

export default function CategorySelector({ value, onChange, multiple = false }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        Category {multiple && '(Select one or more)'}
      </label>
      <div className="flex flex-wrap gap-2">
        {DEFAULT_CATEGORIES.map((category) => {
          const isSelected = multiple 
            ? value.includes(category.id)
            : value === category.id;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                if (multiple) {
                  if (isSelected) {
                    onChange(value.filter(id => id !== category.id));
                  } else {
                    onChange([...value, category.id]);
                  }
                } else {
                  onChange(category.id);
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
