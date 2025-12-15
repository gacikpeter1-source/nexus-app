// src/components/StatsTemplateManager.jsx
import { useState } from 'react';

export default function StatsTemplateManager({ 
  team,
  onSave, 
  onClose 
}) {
  const [statsTemplate, setStatsTemplate] = useState(team.statsTemplate || {
    enabled: false,
    sections: [
      {
        id: 'bio',
        name: 'Bio',
        enabled: true,
        fields: [
          { id: 'age', label: 'Age', type: 'number', enabled: true },
          { id: 'height', label: 'Size', type: 'text', enabled: true },
          { id: 'weight', label: 'Weight', type: 'text', enabled: false }
        ]
      },
      {
        id: 'usage',
        name: 'Usage',
        enabled: true,
        fields: [
          { id: 'toi', label: 'TOI', type: 'number', enabled: true },
          { id: 'role', label: 'Role', type: 'text', enabled: true }
        ]
      },
      {
        id: 'contract',
        name: 'Contract',
        enabled: false,
        fields: [
          { id: 'salary', label: 'Salary', type: 'currency', enabled: true },
          { id: 'marketValue', label: 'Market Value', type: 'currency', enabled: true }
        ]
      },
      {
        id: 'season',
        name: 'Season Stats',
        enabled: true,
        fields: [
          { id: 'gp', label: 'GP', type: 'number', enabled: true },
          { id: 'goals', label: 'G', type: 'number', enabled: true },
          { id: 'assists', label: 'A', type: 'number', enabled: true },
          { id: 'points', label: 'PTS', type: 'number', enabled: true }
        ]
      },
      {
        id: 'performance',
        name: 'Performance',
        enabled: true,
        fields: [
          { id: 'goalsBar', label: 'Goals', type: 'bar', enabled: true, color: '#fbbf24' },
          { id: 'assistsBar', label: 'Assists', type: 'bar', enabled: true, color: '#fb923c' },
          { id: 'pointsBar', label: 'Points', type: 'bar', enabled: true, color: '#fbbf24' }
        ]
      }
    ]
  });

  const [editingSection, setEditingSection] = useState(null);
  const [newField, setNewField] = useState({
    label: '',
    type: 'text'
  });

  const fieldTypes = [
    { value: 'text', label: 'Text', icon: '📝' },
    { value: 'number', label: 'Number', icon: '🔢' },
    { value: 'currency', label: 'Currency', icon: '💰' },
    { value: 'bar', label: 'Progress Bar', icon: '📊' },
    { value: 'calculated', label: 'Calculated', icon: '🧮' }
  ];

  const handleAddSection = () => {
    const sectionName = prompt('Enter section name:');
    if (!sectionName) return;

    const newSection = {
      id: `section_${Date.now()}`,
      name: sectionName,
      enabled: true,
      fields: []
    };

    setStatsTemplate({
      ...statsTemplate,
      sections: [...statsTemplate.sections, newSection]
    });
  };

  const handleRemoveSection = (sectionId) => {
    if (!confirm('Remove this section?')) return;

    setStatsTemplate({
      ...statsTemplate,
      sections: statsTemplate.sections.filter(s => s.id !== sectionId)
    });
  };

  const handleToggleSection = (sectionId) => {
    setStatsTemplate({
      ...statsTemplate,
      sections: statsTemplate.sections.map(s => 
        s.id === sectionId ? { ...s, enabled: !s.enabled } : s
      )
    });
  };

  const handleAddField = (sectionId) => {
    if (!newField.label) {
      alert('Please enter field label');
      return;
    }

    const fieldId = newField.label.toLowerCase().replace(/\s+/g, '_');

    setStatsTemplate({
      ...statsTemplate,
      sections: statsTemplate.sections.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            fields: [...section.fields, {
              id: fieldId,
              label: newField.label,
              type: newField.type,
              enabled: true,
              color: newField.type === 'bar' ? '#3b82f6' : undefined
            }]
          };
        }
        return section;
      })
    });

    setNewField({ label: '', type: 'text' });
    setEditingSection(null);
  };

  const handleRemoveField = (sectionId, fieldId) => {
    setStatsTemplate({
      ...statsTemplate,
      sections: statsTemplate.sections.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            fields: section.fields.filter(f => f.id !== fieldId)
          };
        }
        return section;
      })
    });
  };

  const handleToggleField = (sectionId, fieldId) => {
    setStatsTemplate({
      ...statsTemplate,
      sections: statsTemplate.sections.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            fields: section.fields.map(f => 
              f.id === fieldId ? { ...f, enabled: !f.enabled } : f
            )
          };
        }
        return section;
      })
    });
  };

  const handleSave = async () => {
    try {
          console.log('📊 Saving statsTemplate:', statsTemplate);
    console.log('📦 Sending to onSave:', { statsTemplate: statsTemplate });

      await onSave({ statsTemplate: statsTemplate });
      onClose();
    } catch (error) {
      console.error('❌ Error saving stats template:', error);
      alert('Failed to save stats template');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 sticky top-0 bg-mid-dark z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">
                📊 Stats Template Configuration
              </h3>
              <p className="text-sm text-light/60 mt-1">
                Configure detailed stats sections for {team.name} member cards
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-light/60 hover:text-light transition"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Enable Stats Panel */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <label className="flex items-center gap-3 text-light cursor-pointer">
              <input
                type="checkbox"
                checked={statsTemplate.enabled}
                onChange={(e) => setStatsTemplate({...statsTemplate, enabled: e.target.checked})}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="font-semibold">Enable Detailed Stats Panel</div>
                <div className="text-xs text-light/60">Show sliding stats panel on member cards</div>
              </div>
            </label>
          </div>

          {/* Sections */}
          {statsTemplate.enabled && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-light">Stats Sections</h4>
                <button
                  onClick={handleAddSection}
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm transition"
                >
                  ➕ Add Section
                </button>
              </div>

              {statsTemplate.sections.map((section) => (
                <div
                  key={section.id}
                  className="bg-white/5 border border-white/10 rounded-lg p-4"
                >
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={() => handleToggleSection(section.id)}
                        className="rounded"
                      />
                      <h5 className="font-semibold text-light">{section.name}</h5>
                      <span className="text-xs text-light/50">
                        ({section.fields.filter(f => f.enabled).length} fields)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingSection(editingSection === section.id ? null : section.id)}
                        className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-sm transition"
                      >
                        {editingSection === section.id ? 'Done' : 'Add Field'}
                      </button>
                      <button
                        onClick={() => handleRemoveSection(section.id)}
                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="space-y-2">
                    {section.fields.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center justify-between bg-white/5 rounded p-3"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={field.enabled}
                            onChange={() => handleToggleField(section.id, field.id)}
                            className="rounded"
                          />
                          <div>
                            <div className="text-light font-medium">{field.label}</div>
                            <div className="text-xs text-light/50">
                              {fieldTypes.find(t => t.value === field.type)?.icon} {fieldTypes.find(t => t.value === field.type)?.label}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveField(section.id, field.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Field Form */}
                  {editingSection === section.id && (
                    <div className="mt-3 p-3 bg-white/5 border border-white/20 rounded-lg">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newField.label}
                          onChange={(e) => setNewField({...newField, label: e.target.value})}
                          placeholder="Field label (e.g., Goals, Height)"
                          className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light placeholder-light/40"
                        />
                        <select
                          value={newField.type}
                          onChange={(e) => setNewField({...newField, type: e.target.value})}
                          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light"
                        >
                          {fieldTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.icon} {type.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAddField(section.id)}
                          className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm transition"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          {statsTemplate.enabled && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-300 text-sm">
                💡 <strong>How it works:</strong> Members will see a "🧾" button on their card. 
                Clicking it opens a sliding panel showing all enabled sections and fields. 
                You can add custom sections, rename fields, and choose how data is displayed (text, numbers, charts).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-mid-dark sticky bottom-0">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-semibold"
            >
              💾 Save Template
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
