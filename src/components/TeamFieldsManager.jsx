// src/components/TeamFieldsManager.jsx - WITH TABS
import { useState } from 'react';

export default function TeamFieldsManager({ 
  team, 
  onSave, 
  onClose 
}) {
  const [activeTab, setActiveTab] = useState('fields'); // 'fields' or 'stats'
  
  // Custom Fields State
  const [customFields, setCustomFields] = useState(
  Array.isArray(team.customFields) ? team.customFields : []
    );
  const [newField, setNewField] = useState({
    key: '',
    label: '',
    type: 'text',
    required: false,
    viewMode: 'basic', // 'basic' or 'detailed'
    options: []
  });
  const [editingField, setEditingField] = useState(null);
  
  // Stats Template State
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
  const [newStatsField, setNewStatsField] = useState({ label: '', type: 'text' });
  
  const [saving, setSaving] = useState(false);

  // Field Types
  const fieldTypes = [
    { value: 'text', label: 'Text Input', icon: '📝' },
    { value: 'number', label: 'Number', icon: '🔢' },
    { value: 'dropdown', label: 'Dropdown Menu', icon: '📋' },
    { value: 'range', label: 'Number Range', icon: '📊' }
  ];

  const statsFieldTypes = [
    { value: 'text', label: 'Text', icon: '📝' },
    { value: 'number', label: 'Number', icon: '🔢' },
    { value: 'currency', label: 'Currency', icon: '💰' },
    { value: 'bar', label: 'Progress Bar', icon: '📊' }
  ];

  // ===== CUSTOM FIELDS FUNCTIONS =====
  
  const handleAddField = () => {
    if (!newField.key || !newField.label) {
      alert('Please enter field key and label');
      return;
    }

    if (customFields.some(f => f.key === newField.key)) {
      alert('Field key already exists');
      return;
    }

    if (newField.type === 'dropdown' && newField.options.length === 0) {
      alert('Please add at least one option for dropdown');
      return;
    }

    setCustomFields([...customFields, { ...newField, id: Date.now() }]);
    setNewField({
      key: '',
      label: '',
      type: 'text',
      required: false,
      viewMode: 'basic',
      options: []
    });
  };

  const handleRemoveField = (fieldId) => {
    if (confirm('Remove this field?')) {
      setCustomFields(customFields.filter(f => f.id !== fieldId));
    }
  };

  const handleAddOption = () => {
    const option = prompt('Enter dropdown option:');
    if (option) {
      setNewField({
        ...newField,
        options: [...newField.options, option]
      });
    }
  };

  const handleRemoveOption = (index) => {
    setNewField({
      ...newField,
      options: newField.options.filter((_, i) => i !== index)
    });
  };

  // ===== STATS TEMPLATE FUNCTIONS =====
  
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

  const handleAddStatsField = (sectionId) => {
    if (!newStatsField.label) {
      alert('Please enter field label');
      return;
    }

    const fieldId = newStatsField.label.toLowerCase().replace(/\s+/g, '_');

    setStatsTemplate({
      ...statsTemplate,
      sections: statsTemplate.sections.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            fields: [...section.fields, {
              id: fieldId,
              label: newStatsField.label,
              type: newStatsField.type,
              enabled: true,
              color: newStatsField.type === 'bar' ? '#3b82f6' : undefined
            }]
          };
        }
        return section;
      })
    });

    setNewStatsField({ label: '', type: 'text' });
    setEditingSection(null);
  };

  const handleRemoveStatsField = (sectionId, fieldId) => {
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

  const handleToggleStatsField = (sectionId, fieldId) => {
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

  // ===== SAVE FUNCTION =====
  
const handleSave = async () => {
  setSaving(true);
  try {
    console.log('💾 TeamFieldsManager saving:', {
      customFields: customFields,
      statsTemplate: statsTemplate
    });
    
    await onSave({ 
      customFields,
      statsTemplate 
    });
    onClose();
  } catch (error) {
    console.error('❌ Error saving:', error);
    alert('Failed to save');
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 sticky top-0 bg-mid-dark z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">Configure Team Settings</h3>
              <p className="text-sm text-light/60 mt-1">Manage fields and stats for {team.name}</p>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="text-light/60 hover:text-light transition"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 border-b border-white/10">
            <button
              onClick={() => setActiveTab('fields')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'fields'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-light/60 hover:text-light'
              }`}
            >
              📝 Custom Fields
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'stats'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-light/60 hover:text-light'
              }`}
            >
              📊 Stats Template
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'fields' ? (
            // CUSTOM FIELDS TAB
            <div className="space-y-6">
              {/* Existing custom fields code */}
              <div>
                <h4 className="font-semibold text-light mb-3">Current Fields ({customFields.length})</h4>
                
                {customFields.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center">
                    <p className="text-light/60">No custom fields yet</p>
                    <p className="text-light/40 text-sm mt-1">Add fields below</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customFields.map((field) => (
                      <div
                        key={field.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-semibold text-light">{field.label}</h5>
                              {field.required && (
                                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                                  Required
                                </span>
                              )}
                              {field.viewMode === 'detailed' && (
                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
                                  📄 Detailed View Only
                                </span>
                              )}
                              {(!field.viewMode || field.viewMode === 'basic') && (
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">
                                  👁️ Basic View
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-light/60">
                              Key: <code className="bg-white/10 px-2 py-0.5 rounded">{field.key}</code>
                              {' • '}
                              Type: {fieldTypes.find(t => t.value === field.type)?.icon} {field.type}
                            </div>
                            {field.type === 'dropdown' && field.options && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {field.options.map((opt, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded">
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveField(field.id)}
                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Field */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h4 className="font-semibold text-light mb-4">➕ Add Custom Field</h4>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-light/80 mb-2">
                        Field Label
                      </label>
                      <input
                        type="text"
                        value={newField.label}
                        onChange={(e) => setNewField({...newField, label: e.target.value})}
                        placeholder="e.g., Jersey Number, Position"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-light/80 mb-2">
                        Field Key (unique)
                      </label>
                      <input
                        type="text"
                        value={newField.key}
                        onChange={(e) => setNewField({...newField, key: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                        placeholder="e.g., jersey_number, position"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Field Type
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {fieldTypes.map(type => (
                        <button
                          key={type.value}
                          onClick={() => setNewField({...newField, type: type.value})}
                          className={`p-3 rounded-lg border-2 transition ${
                            newField.type === type.value
                              ? 'border-primary bg-primary/20'
                              : 'bg-white/5 border-white/20 hover:border-primary/50'
                          }`}
                        >
                          <div className="text-2xl mb-1">{type.icon}</div>
                          <div className="text-xs text-light">{type.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {newField.type === 'dropdown' && (
                    <div>
                      <label className="block text-sm font-medium text-light/80 mb-2">
                        Dropdown Options
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {newField.options.map((option, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm flex items-center gap-2"
                          >
                            {option}
                            <button
                              onClick={() => handleRemoveOption(idx)}
                              className="hover:text-red-400"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={handleAddOption}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg text-sm transition"
                      >
                        + Add Option
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Card View Display
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewField({...newField, viewMode: 'basic'})}
                        className={`p-3 rounded-lg border-2 transition ${
                          newField.viewMode === 'basic'
                            ? 'border-green-500 bg-green-500/20 text-green-300'
                            : 'bg-white/5 border-white/20 text-light/60 hover:border-green-500/50'
                        }`}
                      >
                        <div className="text-2xl mb-1">👁️</div>
                        <div className="text-xs font-semibold">Basic View</div>
                        <div className="text-[10px] mt-1">Always visible</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewField({...newField, viewMode: 'detailed'})}
                        className={`p-3 rounded-lg border-2 transition ${
                          newField.viewMode === 'detailed'
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                            : 'bg-white/5 border-white/20 text-light/60 hover:border-purple-500/50'
                        }`}
                      >
                        <div className="text-2xl mb-1">📄</div>
                        <div className="text-xs font-semibold">Detailed View</div>
                        <div className="text-[10px] mt-1">Click to see</div>
                      </button>
                    </div>
                    <p className="text-xs text-light/50 mt-2">
                      <strong>Basic:</strong> Shown on front of card • <strong>Detailed:</strong> Shown when card is clicked/flipped
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-light">
                    <input
                      type="checkbox"
                      checked={newField.required}
                      onChange={(e) => setNewField({...newField, required: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Required field</span>
                  </label>

                  <button
                    onClick={handleAddField}
                    className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-semibold"
                  >
                    ➕ Add Field
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // STATS TEMPLATE TAB
            <div className="space-y-6">
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
                                onChange={() => handleToggleStatsField(section.id, field.id)}
                                className="rounded"
                              />
                              <div>
                                <div className="text-light font-medium">{field.label}</div>
                                <div className="text-xs text-light/50">
                                  {statsFieldTypes.find(t => t.value === field.type)?.icon} {statsFieldTypes.find(t => t.value === field.type)?.label}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveStatsField(section.id, field.id)}
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
                              value={newStatsField.label}
                              onChange={(e) => setNewStatsField({...newStatsField, label: e.target.value})}
                              placeholder="Field label (e.g., Goals, Height)"
                              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light placeholder-light/40"
                            />
                            <select
                              value={newStatsField.type}
                              onChange={(e) => setNewStatsField({...newStatsField, type: e.target.value})}
                              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light"
                            >
                              {statsFieldTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.icon} {type.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAddStatsField(section.id)}
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
                    💡 <strong>How it works:</strong> Members will see a 🧾 button on their card. 
                    Clicking it opens a sliding panel showing all enabled sections and fields.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-mid-dark sticky bottom-0">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : '💾 Save All Settings'}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
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
