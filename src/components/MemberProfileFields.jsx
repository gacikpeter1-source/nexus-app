// Add these fields to your UserProfile or Settings page

// src/components/MemberProfileFields.jsx
export default function MemberProfileFields({ userData, onUpdate }) {
  const [formData, setFormData] = useState({
    jerseyNumber: userData.jerseyNumber || '',
    position: userData.position || '',
    handedness: userData.handedness || '',
    age: userData.age || '',
    phone: userData.phone || ''
  });

  const positions = [
    'Forward',
    'Defense',
    'Goalie',
    'Center',
    'Winger',
    'Midfielder',
    'Striker',
    'Goalkeeper',
    'Swimmer',
    'Runner',
    'Custom'
  ];

  const handleSave = async () => {
    try {
      await onUpdate(formData);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-light mb-4">Member Card Information</h3>

      {/* Jersey Number */}
      <div>
        <label className="block text-sm font-medium text-light/80 mb-2">
          Jersey Number (Optional)
        </label>
        <input
          type="number"
          value={formData.jerseyNumber}
          onChange={(e) => setFormData({...formData, jerseyNumber: e.target.value})}
          placeholder="e.g., 23"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light"
        />
      </div>

      {/* Position */}
      <div>
        <label className="block text-sm font-medium text-light/80 mb-2">
          Position
        </label>
        <select
          value={formData.position}
          onChange={(e) => setFormData({...formData, position: e.target.value})}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light"
        >
          <option value="">Select position...</option>
          {positions.map(pos => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>
      </div>

      {/* Custom Position */}
      {formData.position === 'Custom' && (
        <div>
          <label className="block text-sm font-medium text-light/80 mb-2">
            Custom Position
          </label>
          <input
            type="text"
            value={formData.customPosition || ''}
            onChange={(e) => setFormData({...formData, position: e.target.value})}
            placeholder="Enter your position"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light"
          />
        </div>
      )}

      {/* Handedness */}
      <div>
        <label className="block text-sm font-medium text-light/80 mb-2">
          Handedness/Footedness (Optional)
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-light cursor-pointer">
            <input
              type="radio"
              value="left"
              checked={formData.handedness === 'left'}
              onChange={(e) => setFormData({...formData, handedness: e.target.value})}
              className="text-primary"
            />
            Left
          </label>
          <label className="flex items-center gap-2 text-light cursor-pointer">
            <input
              type="radio"
              value="right"
              checked={formData.handedness === 'right'}
              onChange={(e) => setFormData({...formData, handedness: e.target.value})}
              className="text-primary"
            />
            Right
          </label>
          <label className="flex items-center gap-2 text-light cursor-pointer">
            <input
              type="radio"
              value=""
              checked={!formData.handedness}
              onChange={(e) => setFormData({...formData, handedness: ''})}
              className="text-primary"
            />
            Not specified
          </label>
        </div>
      </div>

      {/* Age */}
      <div>
        <label className="block text-sm font-medium text-light/80 mb-2">
          Age (Optional)
        </label>
        <input
          type="number"
          value={formData.age}
          onChange={(e) => setFormData({...formData, age: e.target.value})}
          placeholder="e.g., 25"
          min="1"
          max="120"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-light/80 mb-2">
          Phone Number (Optional)
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          placeholder="+421 123 456 789"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light"
        />
      </div>

      <button
        onClick={handleSave}
        className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-semibold"
      >
        Save Profile
      </button>
    </div>
  );
}
