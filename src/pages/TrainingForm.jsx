// src/pages/TrainingForm.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createTraining, getTraining, updateTraining } from '../firebase/firestore';
import CategorySelector from '../components/CategorySelector';

export default function TrainingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 60,
    categories: [],
    difficulty: 'intermediate',
    equipment: [],
    drills: [],
    notes: ''
  });

  // Load existing training if editing
  useEffect(() => {
    if (isEditMode) {
      loadTraining();
    }
  }, [id]);

  const loadTraining = async () => {
    try {
      setLoading(true);
      const training = await getTraining(id);
      if (!training) {
        showToast('Training not found', 'error');
        navigate('/training-library');
        return;
      }
      if (training.createdBy !== user.id) {
        showToast('You can only edit your own trainings', 'error');
        navigate('/training-library');
        return;
      }
      setFormData(training);
    } catch (error) {
      console.error('Error loading training:', error);
      showToast('Failed to load training', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      showToast('Please enter a training title', 'error');
      return;
    }

    try {
      setSaving(true);
      
      if (isEditMode) {
        await updateTraining(id, formData);
        showToast('Training updated successfully', 'success');
      } else {
        await createTraining({
          ...formData,
          createdBy: user.id,
          createdAt: new Date()
        });
        showToast('Training created successfully', 'success');
      }
      
      navigate('/training-library');
    } catch (error) {
      console.error('Error saving training:', error);
      showToast('Failed to save training', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚽</div>
          <p className="text-light/60">Loading training...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/training-library')}
          className="text-light/60 hover:text-light transition mb-4 flex items-center gap-2"
        >
          ← Back to Library
        </button>
        <h1 className="font-title text-4xl text-light mb-2">
          {isEditMode ? 'Edit Training' : 'Create New Training'}
        </h1>
        <p className="text-light/60">
          {isEditMode ? 'Update your training plan' : 'Design a new training plan for your team'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-mid-dark border border-white/20 rounded-xl p-6 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Training Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g., Power Play Practice, Skating Drills, etc."
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe the goals and focus of this training..."
            rows={4}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Duration (minutes)
          </label>
          <input
            type="number"
            value={formData.duration}
            onChange={(e) => handleChange('duration', parseInt(e.target.value))}
            min="15"
            max="300"
            step="5"
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Categories */}
        <CategorySelector
          value={formData.categories}
          onChange={(categories) => handleChange('categories', categories)}
          multiple={true}
        />

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Difficulty Level
          </label>
          <div className="flex gap-3">
            {['beginner', 'intermediate', 'advanced'].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => handleChange('difficulty', level)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  formData.difficulty === level
                    ? 'bg-primary text-white'
                    : 'bg-white/10 text-light hover:bg-white/20'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Additional Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Any additional notes, tips, or reminders..."
            rows={3}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => navigate('/training-library')}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                {isEditMode ? '💾 Update Training' : '✨ Create Training'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
