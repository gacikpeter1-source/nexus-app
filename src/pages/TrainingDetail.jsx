// src/pages/TrainingDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getTraining, deleteTraining } from '../firebase/firestore';
import { DEFAULT_CATEGORIES } from '../components/CategorySelector';

export default function TrainingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  
  useEffect(() => {
    loadTraining();
  }, [id]);
  
  async function loadTraining() {
    try {
      setLoading(true);
      const data = await getTraining(id);
      if (data) {
        setTraining(data);
      } else {
        showToast('Training not found', 'error');
        navigate('/training-library');
      }
    } catch (error) {
      console.error('Error loading training:', error);
      showToast('Failed to load training', 'error');
      navigate('/training-library');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this training?')) return;
    
    try {
      await deleteTraining(id);
      showToast('Training deleted successfully', 'success');
      navigate('/training-library');
    } catch (error) {
      console.error('Error deleting training:', error);
      showToast('Failed to delete training', 'error');
    }
  }
  
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
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light/60">Loading training...</div>
      </div>
    );
  }
  
  if (!training) {
    return null;
  }
  
  const isOwner = training.ownerId === user?.id;
  
  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/training-library"
          className="inline-flex items-center text-primary hover:text-primary/80 mb-4"
        >
          ← Back to Library
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-4xl text-light mb-2">
              {training.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              {training.categories && training.categories.map(catId => (
                <span
                  key={catId}
                  className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm"
                >
                  {getCategoryIcon(catId)} {getCategoryName(catId)}
                </span>
              ))}
            </div>
          </div>
          
          {isOwner && (
            <div className="flex gap-2">
              <Link
                to={`/training-library/${training.id}/edit`}
                className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-all"
              >
                Edit
              </Link>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Image Gallery */}
      {training.pictures && training.pictures.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-6">
          {/* Main Image */}
          <div className="relative h-96 mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
            <img
              src={training.pictures[selectedImage]}
              alt={`Training ${selectedImage + 1}`}
              className="w-full h-full object-contain"
            />
          </div>
          
          {/* Thumbnails */}
          {training.pictures.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {training.pictures.map((pic, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`relative h-24 rounded-lg overflow-hidden transition-all ${
                    selectedImage === index
                      ? 'ring-2 ring-primary'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={pic}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Description */}
      {training.description && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="font-title text-xl text-light mb-3">Description</h2>
          <p className="text-light/70 whitespace-pre-wrap">{training.description}</p>
        </div>
      )}
      
      {/* Statistics */}
      {training.statistics && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h2 className="font-title text-xl text-light mb-3">Usage Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {training.statistics.timesUsed || 0}
              </div>
              <div className="text-sm text-light/60">Times Used</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent">
                {training.statistics.totalParticipants || 0}
              </div>
              <div className="text-sm text-light/60">Total Participants</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">
                {training.statistics.eventsUsed?.length || 0}
              </div>
              <div className="text-sm text-light/60">Events</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

