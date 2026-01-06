// src/components/TrainingBrowserModal.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function TrainingBrowserModal({ isOpen, onClose, onSelect }) {
  const { user } = useAuth();
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTrainings();
    }
  }, [isOpen]);

  const loadTrainings = async () => {
    try {
      setLoading(true);
      // Load trainings from localStorage or Firestore
      // This is a placeholder - adjust based on your data source
      const storedTrainings = JSON.parse(localStorage.getItem('trainings') || '[]');
      setTrainings(storedTrainings);
    } catch (error) {
      console.error('Error loading trainings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrainings = trainings.filter(training =>
    training.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    training.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-title text-2xl text-light">Browse Trainings</h3>
              <p className="text-sm text-light/60 mt-1">
                Select a training to attach to this event
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-light/60 hover:text-light transition text-2xl"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search trainings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Trainings List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-light/60">Loading trainings...</p>
            </div>
          ) : filteredTrainings.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-light/60">
                {searchTerm ? 'No trainings found matching your search' : 'No trainings available'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTrainings.map((training) => (
                <button
                  key={training.id}
                  onClick={() => {
                    onSelect(training);
                    onClose();
                  }}
                  className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-light mb-1">
                        {training.name || 'Unnamed Training'}
                      </h4>
                      {training.description && (
                        <p className="text-sm text-light/60 line-clamp-2">
                          {training.description}
                        </p>
                      )}
                      {training.date && (
                        <p className="text-xs text-light/40 mt-1">
                          📅 {new Date(training.date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <span className="text-primary">→</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
