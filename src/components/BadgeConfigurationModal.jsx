// src/components/BadgeConfigurationModal.jsx
import { useState } from 'react';

export default function BadgeConfigurationModal({ 
  team,
  onSave, 
  onClose 
}) {
  const [badgeSettings, setBadgeSettings] = useState(team.badgeSettings || {
    enabled: false,
    rules: [],
    displayDuration: 'permanent' // 'permanent', 'weekly', 'monthly'
  });

  const [newRule, setNewRule] = useState({
    name: '',
    badge: 'bronze', // iron, bronze, silver, gold, platinum
    criteria: {
      stat: '',
      operator: 'gte', // gte, lte, eq
      value: ''
    }
  });

  const badgeTypes = [
    { value: 'iron', label: 'Iron', icon: '⚪', color: '#71717a' },
    { value: 'bronze', label: 'Bronze', icon: '🥉', color: '#cd7f32' },
    { value: 'silver', label: 'Silver', icon: '🥈', color: '#c0c0c0' },
    { value: 'gold', label: 'Gold', icon: '🥇', color: '#ffd700' },
    { value: 'platinum', label: 'Platinum', icon: '💎', color: '#e5e4e2' }
  ];

  const operators = [
    { value: 'gte', label: '≥ (Greater than or equal)' },
    { value: 'lte', label: '≤ (Less than or equal)' },
    { value: 'eq', label: '= (Equal to)' }
  ];

  // Get available stats from team custom fields
  const availableStats = team.customStats || [];

  const handleAddRule = () => {
    if (!newRule.name || !newRule.criteria.stat || !newRule.criteria.value) {
      alert('Please fill all rule fields');
      return;
    }

    setBadgeSettings({
      ...badgeSettings,
      rules: [...badgeSettings.rules, { ...newRule, id: Date.now() }]
    });

    setNewRule({
      name: '',
      badge: 'bronze',
      criteria: {
        stat: '',
        operator: 'gte',
        value: ''
      }
    });
  };

  const handleRemoveRule = (ruleId) => {
    setBadgeSettings({
      ...badgeSettings,
      rules: badgeSettings.rules.filter(r => r.id !== ruleId)
    });
  };

  const handleSave = async () => {
    try {
      await onSave(badgeSettings);
      onClose();
    } catch (error) {
      console.error('Error saving badge settings:', error);
      alert('Failed to save badge settings');
    }
  };

  const getBadgeIcon = (badgeType) => {
    const badge = badgeTypes.find(b => b.value === badgeType);
    return badge ? badge.icon : '⭐';
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 sticky top-0 bg-mid-dark z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">
                🌟 Badge Configuration
              </h3>
              <p className="text-sm text-light/60 mt-1">
                Configure achievement badges for {team.name}
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
          {/* Enable Badges */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <label className="flex items-center gap-3 text-light cursor-pointer">
              <input
                type="checkbox"
                checked={badgeSettings.enabled}
                onChange={(e) => setBadgeSettings({...badgeSettings, enabled: e.target.checked})}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="font-semibold">Enable Badge System</div>
                <div className="text-xs text-light/60">Show achievement badges on member cards</div>
              </div>
            </label>
          </div>

          {/* Display Duration */}
          {badgeSettings.enabled && (
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">
                Badge Display Duration
              </label>
              <select
                value={badgeSettings.displayDuration}
                onChange={(e) => setBadgeSettings({...badgeSettings, displayDuration: e.target.value})}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              >
                <option value="permanent">Permanent (until stats change)</option>
                <option value="weekly">Weekly (reset every week)</option>
                <option value="monthly">Monthly (reset every month)</option>
              </select>
            </div>
          )}

          {/* Current Rules */}
          {badgeSettings.enabled && (
            <div>
              <h4 className="font-semibold text-light mb-3">
                Badge Rules ({badgeSettings.rules.length})
              </h4>
              
              {badgeSettings.rules.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center">
                  <p className="text-light/60">No badge rules yet</p>
                  <p className="text-light/40 text-sm mt-1">Add rules below to award badges</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {badgeSettings.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-3xl">
                            {getBadgeIcon(rule.badge)}
                          </span>
                          <div>
                            <h5 className="font-semibold text-light">{rule.name}</h5>
                            <p className="text-sm text-light/60 mt-1">
                              If <strong>{rule.criteria.stat}</strong> {operators.find(o => o.value === rule.criteria.operator)?.label.split(' ')[0]} <strong>{rule.criteria.value}</strong>
                            </p>
                            <div className="mt-1">
                              <span 
                                className="px-2 py-1 rounded text-xs font-medium"
                                style={{ 
                                  backgroundColor: `${badgeTypes.find(b => b.value === rule.badge)?.color}20`,
                                  color: badgeTypes.find(b => b.value === rule.badge)?.color
                                }}
                              >
                                {badgeTypes.find(b => b.value === rule.badge)?.label} Badge
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveRule(rule.id)}
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
          )}

          {/* Add New Rule */}
          {badgeSettings.enabled && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h4 className="font-semibold text-light mb-4">➕ Add Badge Rule</h4>
              
              <div className="space-y-4">
                {/* Rule Name */}
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={newRule.name}
                    onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                    placeholder="e.g., Top Scorer, Perfect Attendance"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>

                {/* Badge Type */}
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">
                    Badge Type
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {badgeTypes.map(badge => (
                      <button
                        key={badge.value}
                        onClick={() => setNewRule({...newRule, badge: badge.value})}
                        className={`p-3 rounded-lg border-2 transition ${
                          newRule.badge === badge.value
                            ? 'border-primary bg-primary/20'
                            : 'bg-white/5 border-white/20 hover:border-primary/50'
                        }`}
                      >
                        <div className="text-2xl mb-1">{badge.icon}</div>
                        <div className="text-xs text-light">{badge.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Criteria */}
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">
                    Award When...
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Stat */}
                    <select
                      value={newRule.criteria.stat}
                      onChange={(e) => setNewRule({
                        ...newRule, 
                        criteria: {...newRule.criteria, stat: e.target.value}
                      })}
                      className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                    >
                      <option value="">Select stat...</option>
                      {availableStats.map(stat => (
                        <option key={stat.key} value={stat.key}>{stat.label}</option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      value={newRule.criteria.operator}
                      onChange={(e) => setNewRule({
                        ...newRule, 
                        criteria: {...newRule.criteria, operator: e.target.value}
                      })}
                      className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                    >
                      {operators.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>

                    {/* Value */}
                    <input
                      type="number"
                      value={newRule.criteria.value}
                      onChange={(e) => setNewRule({
                        ...newRule, 
                        criteria: {...newRule.criteria, value: e.target.value}
                      })}
                      placeholder="Value"
                      className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                    />
                  </div>
                  <p className="text-xs text-light/50 mt-2">
                    Example: If <strong>attendance</strong> ≥ <strong>95</strong>, award Gold badge
                  </p>
                </div>

                {/* Add Button */}
                <button
                  onClick={handleAddRule}
                  className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-semibold"
                >
                  ➕ Add Rule
                </button>
              </div>
            </div>
          )}

          {/* Info Box */}
          {badgeSettings.enabled && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-300 text-sm">
                💡 <strong>How it works:</strong> Badges are automatically awarded based on member statistics. 
                You can have multiple rules, and members can earn multiple badges. 
                Higher-tier badges (Platinum, Gold) will be displayed first.
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
              💾 Save Badge Configuration
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
