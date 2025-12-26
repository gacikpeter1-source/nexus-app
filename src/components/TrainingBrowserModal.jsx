// src/components/TrainingBrowserModal.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTrainerTrainings } from '../firebase/firestore';
import { DEFAULT_CATEGORIES } from './CategorySelector';

export default function TrainingBrowserModal({ isOpen, onClose, onSelect }) {
  const { user } = useAuth();
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  useEffect(() => {
    if (isOpen && user) {
      loadTrainings();
    }
  }, [isOpen, user]);
  
  async function loadTrainings() {
    try {
      setLoading(true);
      const data = await getTrainerTrainings(user.id);
      setTrainings(data);
    } catch (error) {
      console.error('Error loading trainings:', error);
    } finally {
      setLoading(false);
    }
  }
  
  const filteredTrainings = useMemo(() => {
    let filtered = trainings;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t =>
        t.categories && t.categories.includes(selectedCategory)
      );
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [trainings, selectedCategory, searchQuery]);
  
  function getCategoryName(categoryId) {
    const category = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
    if (category) return category.name;
    // Custom category - capitalize first letter of each word
    return categoryId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  
  function getCategoryIcon(categoryId) {
    const category = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
    return category ? category.icon : '✨';
  }
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-title text-2xl text-light">Select Training from Library</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/15 rounded-lg transition-all"
            >
              ✕
            </button>
          </div>
          
          {/* Search */}
          <input
            type="text"
            placeholder="Search trainings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          
          {/* Category Filter */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-sm transition-all ${
                selectedCategory === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              All
            </button>
            {DEFAULT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-sm transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-white'
                    : 'bg-white/10 text-light hover:bg-white/15'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-light/60 py-12">Loading trainings...</div>
          ) : filteredTrainings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-light/60">No trainings found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTrainings.map(training => (
                <button
                  key={training.id}
                  onClick={() => {
                    onSelect(training);
                    onClose();
                  }}
                  className="text-left bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-primary/50 transition-all group"
                >
                  {/* Training Image */}
                  <div className="relative h-32 bg-gradient-to-br from-primary/20 to-accent/20">
                    {training.pictures && training.pictures[0] ? (
                      <img
                        src={training.pictures[0]}
                        alt={training.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        📚
                      </div>
                    )}
                    {/* Category badges */}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {training.categories && training.categories.slice(0, 2).map(catId => (
                        <span
                          key={catId}
                          className="px-2 py-0.5 bg-black/70 text-white text-xs rounded-full"
                        >
                          {getCategoryIcon(catId)} {getCategoryName(catId)}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Training Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-light mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                      {training.title}
                    </h3>
                    {training.description && (
                      <p className="text-sm text-light/60 line-clamp-2">
                        {training.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

