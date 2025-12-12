// src/components/TeamFieldsManager.jsx
import { useState } from 'react';

export default function TeamFieldsManager({ 
  team, 
  onSave, 
  onClose 
}) {
  const [customFields, setCustomFields] = useState(team.customFields || []);
  const [newField, setNewField] = useState({
    key: '',
    label: '',
    type: 'text',
    required: false,
    options: [] // For dropdown
  });
  const [editingField, setEditingField] = useState(null);
  const [saving, setSaving] = useState(false);

  const fieldTypes = [
    { value: 'text', label: 'Text Input', icon: '📝' },
    { value: 'number', label: 'Number', icon: '🔢' },
    { value: 'dropdown', label: 'Dropdown Menu', icon: '📋' },
    { value: 'range', label: 'Number Range', icon: '📊' }
  ];

  const handleAddField = () => {
    if (!newField.key || !newField.label) {
      alert('Please enter field key and label');
      return;
    }

    // Check for duplicate keys
    if (customFields.some(f => f.key === newField.key)) {
      alert('Field key already exists');
      return;
    }

    // For dropdown, ensure options exist
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
      options: []
    });
  };

  const handleRemoveField = (fieldId) => {
    if (!confirm('Remove this field? Member data will be preserved but hidden.')) return;
    setCustomFields(customFields.filter(f => f.id !== fieldId));
  };

  const handleEditField = (field) => {
    setEditingField(field);
  };

  const handleUpdateField = () => {
    if (!editingField) return;
    
    setCustomFields(customFields.map(f => 
      f.id === editingField.id ? editingField : f
    ));
    setEditingField(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(customFields);
      onClose();
    } catch (error) {
      console.error('Error saving fields:', error);
      alert('Failed to save fields');
    } finally {
      setSaving(false);
    }
  };

  const addDropdownOption = (option) => {
    if (!option.trim()) return;
    setNewField({
      ...newField,
      options: [...newField.options, option.trim()]
    });
  };

  const removeDropdownOption = (index) => {
    setNewField({
      ...newField,
      options: newField.options.filter((_, idx) => idx !== index)
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 sticky top-0 bg-mid-dark z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">
                🔧 Configure Member Card Fields
              </h3>
              <p className="text-sm text-light/60 mt-1">
                Define what information appears on member cards for {team.name}
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
          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              💡 <strong>Tip:</strong> Create custom fields specific to your team's needs. 
              Hockey teams might need "Position" and "Jersey Number", while swimming teams might need "Style" and "Best Time".
            </p>
          </div>

          {/* Current Fields */}
          <div>
            <h4 className="font-semibold text-light mb-3">
              Current Fields ({customFields.length})
            </h4>
            
            {customFields.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center">
                <p className="text-light/60">No custom fields yet</p>
                <p className="text-light/40 text-sm mt-1">Add fields below to get started</p>
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
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">
                            {fieldTypes.find(t => t.value === field.type)?.icon || '📝'}
                          </span>
                          <div>
                            <h5 className="font-semibold text-light">{field.label}</h5>
                            <p className="text-xs text-light/50">Key: {field.key}</p>
                          </div>
                          {field.required && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-light/60">
                          <span>Type: {fieldTypes.find(t => t.value === field.type)?.label}</span>
                          {field.type === 'dropdown' && field.options && (
                            <span>Options: {field.options.length}</span>
                          )}
                        </div>
                        {field.type === 'dropdown' && field.options && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {field.options.map((opt, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                                {opt}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditField(field)}
                          className="px-3 py-1 bg-white/10 hover:bg-white/20 text-light rounded text-sm transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveField(field.id)}
                          className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Field */}
          {!editingField && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h4 className="font-semibold text-light mb-4">➕ Add New Field</h4>
              
              <div className="space-y-4">
                {/* Field Key */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Field Key (unique identifier)
                    </label>
                    <input
                      type="text"
                      value={newField.key}
                      onChange={(e) => setNewField({...newField, key: e.target.value.toLowerCase().replace(/\s/g, '_')})}
                      placeholder="e.g., jersey_number"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                    />
                    <p className="text-xs text-light/50 mt-1">No spaces, lowercase only</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Field Label (display name)
                    </label>
                    <input
                      type="text"
                      value={newField.label}
                      onChange={(e) => setNewField({...newField, label: e.target.value})}
                      placeholder="e.g., Jersey Number"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                    />
                  </div>
                </div>

                {/* Field Type */}
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">
                    Field Type
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {fieldTypes.map(type => (
                      <button
                        key={type.value}
                        onClick={() => setNewField({...newField, type: type.value, options: []})}
                        className={`p-3 rounded-lg border-2 transition ${
                          newField.type === type.value
                            ? 'bg-primary/20 border-primary text-primary'
                            : 'bg-white/5 border-white/20 text-light hover:border-primary/50'
                        }`}
                      >
                        <div className="text-2xl mb-1">{type.icon}</div>
                        <div className="text-xs">{type.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dropdown Options */}
                {newField.type === 'dropdown' && (
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Dropdown Options
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter option and press Add"
                          className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              addDropdownOption(e.target.value);
                              e.target.value = '';
                            }
                          }}
                        />
                        <button
                          onClick={(e) => {
                            const input = e.target.previousElementSibling;
                            addDropdownOption(input.value);
                            input.value = '';
                          }}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
                        >
                          Add
                        </button>
                      </div>
                      {newField.options.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {newField.options.map((option, idx) => (
                            <div key={idx} className="bg-blue-500/20 px-3 py-1 rounded-full text-sm text-blue-300 flex items-center gap-2">
                              {option}
                              <button
                                onClick={() => removeDropdownOption(idx)}
                                className="text-red-400 hover:text-red-300"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Required Checkbox */}
                <label className="flex items-center gap-2 text-light cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newField.required}
                    onChange={(e) => setNewField({...newField, required: e.target.checked})}
                    className="rounded"
                  />
                  Make this field required
                </label>

                {/* Add Button */}
                <button
                  onClick={handleAddField}
                  className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-semibold"
                >
                  ➕ Add Field
                </button>
              </div>
            </div>
          )}

          {/* Edit Field */}
          {editingField && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-6">
              <h4 className="font-semibold text-primary mb-4">✏️ Edit Field: {editingField.label}</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">
                    Field Label
                  </label>
                  <input
                    type="text"
                    value={editingField.label}
                    onChange={(e) => setEditingField({...editingField, label: e.target.value})}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>

                <label className="flex items-center gap-2 text-light cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingField.required}
                    onChange={(e) => setEditingField({...editingField, required: e.target.checked})}
                    className="rounded"
                  />
                  Make this field required
                </label>

                <div className="flex gap-3">
                  <button
                    onClick={handleUpdateField}
                    className="flex-1 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
                  >
                    ✓ Update
                  </button>
                  <button
                    onClick={() => setEditingField(null)}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/10 bg-mid-dark sticky bottom-0">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : '💾 Save Field Configuration'}
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
