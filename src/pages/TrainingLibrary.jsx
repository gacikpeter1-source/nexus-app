// src/pages/TrainingLibrary.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getTrainerTrainings, deleteTraining } from '../firebase/firestore';
import { DEFAULT_CATEGORIES } from '../components/CategorySelector';

export default function TrainingLibrary() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  
  // Load trainings
  useEffect(() => {
    if (user) {
      loadTrainings();
    }
  }, [user]);
  
  async function loadTrainings() {
    try {
      setLoading(true);
      const data = await getTrainerTrainings(user.id);
      setTrainings(data);
    } catch (error) {
      console.error('Error loading trainings:', error);
      showToast('Failed to load trainings', 'error');
    } finally {
      setLoading(false);
    }
  }
  
  // Filter trainings
  const filteredTrainings = useMemo(() => {
    let filtered = trainings;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => 
        t.categories && t.categories.includes(selectedCategory)
      );
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [trainings, selectedCategory, searchQuery]);
  
  // Handle delete training
  async function handleDelete(trainingId) {
    if (!window.confirm('Are you sure you want to delete this training?')) return;
    
    try {
      await deleteTraining(trainingId);
      showToast('Training deleted successfully', 'success');
      loadTrainings();
    } catch (error) {
      console.error('Error deleting training:', error);
      showToast('Failed to delete training', 'error');
    }
  }
  
  // Get category name
  function getCategoryName(categoryId) {
    const category = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
    if (category) return category.name;
    // Custom category - capitalize first letter of each word
    return categoryId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  
  // Get category icon
  function getCategoryIcon(categoryId) {
    const category = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
    return category ? category.icon : '✨';
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light/60">Loading trainings...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-2xl md:text-4xl text-light">
            📚 <span className="text-primary">MY TRAINING LIBRARY</span>
          </h1>
          <Link
            to="/training-library/new"
            className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
          >
            + New Training
          </Link>
        </div>
        <p className="text-light/60 text-sm">
          {filteredTrainings.length} training{filteredTrainings.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      {/* Search & Filters */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search trainings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          
          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              ⊞ Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              ☰ List
            </button>
          </div>
        </div>
        
        {/* Category Filter */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-sm transition-all ${
              selectedCategory === 'all'
                ? 'bg-primary text-white'
                : 'bg-white/10 text-light hover:bg-white/15'
            }`}
          >
            All Categories
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
      
      {/* Trainings List/Grid */}
      {filteredTrainings.length === 0 ? (
        <div className="bg-white/5 border border-dashed border-white/10 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📚</div>
          <h3 className="text-xl text-light/80 mb-2">No Trainings Yet</h3>
          <p className="text-light/50 text-sm mb-4">
            Create your first training to get started!
          </p>
          <Link
            to="/training-library/new"
            className="inline-block px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
          >
            + Create Training
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrainings.map(training => (
            <div
              key={training.id}
              className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-primary/50 transition-all"
            >
              {/* Training Image */}
              <div className="relative h-48 bg-gradient-to-br from-primary/20 to-accent/20">
                {training.pictures && training.pictures[0] ? (
                  <img
                    src={training.pictures[0]}
                    alt={training.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl">
                    📚
                  </div>
                )}
                {/* Category badges */}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {training.categories && training.categories.slice(0, 2).map(catId => (
                    <span
                      key={catId}
                      className="px-2 py-1 bg-black/70 text-white text-xs rounded-full"
                    >
                      {getCategoryIcon(catId)} {getCategoryName(catId)}
                    </span>
                  ))}
                  {training.categories && training.categories.length > 2 && (
                    <span className="px-2 py-1 bg-black/70 text-white text-xs rounded-full">
                      +{training.categories.length - 2}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Training Info */}
              <div className="p-4">
                <h3 className="font-semibold text-light text-lg mb-2 line-clamp-2">
                  {training.title}
                </h3>
                {training.description && (
                  <p className="text-sm text-light/60 mb-4 line-clamp-3">
                    {training.description}
                  </p>
                )}
                
                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    to={`/training-library/${training.id}`}
                    className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg text-sm text-center transition-all"
                  >
                    View
                  </Link>
                  <Link
                    to={`/training-library/${training.id}/edit`}
                    className="flex-1 px-3 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm text-center transition-all"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(training.id)}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-all"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTrainings.map(training => (
            <div
              key={training.id}
              className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-lg p-4 hover:border-primary/50 transition-all"
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 overflow-hidden">
                {training.pictures && training.pictures[0] ? (
                  <img
                    src={training.pictures[0]}
                    alt={training.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl">📚</span>
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-light truncate">
                  {training.title}
                </h3>
                <div className="flex flex-wrap gap-2 mt-1">
                  {training.categories && training.categories.slice(0, 3).map(catId => (
                    <span
                      key={catId}
                      className="px-2 py-0.5 bg-white/10 text-light/70 text-xs rounded-full"
                    >
                      {getCategoryIcon(catId)} {getCategoryName(catId)}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                <Link
                  to={`/training-library/${training.id}`}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-light rounded-lg text-sm transition-all"
                >
                  View
                </Link>
                <Link
                  to={`/training-library/${training.id}/edit`}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm transition-all"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(training.id)}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-all"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

