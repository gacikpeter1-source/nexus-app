// src/pages/TrainingForm.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createTraining, getTraining, updateTraining } from '../firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import CategorySelector from '../components/CategorySelector';

export default function TrainingForm() {
  const { id } = useParams();
  const isEditMode = !!id;
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    categories: [],
    pictures: []
  });
  const [pictureFiles, setPictureFiles] = useState([]);
  
  // Load training for edit mode
  useEffect(() => {
    if (isEditMode && id) {
      loadTraining();
    }
  }, [id, isEditMode]);
  
  async function loadTraining() {
    try {
      setLoading(true);
      const data = await getTraining(id);
      if (data) {
        setForm({
          title: data.title || '',
          description: data.description || '',
          categories: data.categories || [],
          pictures: data.pictures || []
        });
      }
    } catch (error) {
      console.error('Error loading training:', error);
      showToast('Failed to load training', 'error');
      navigate('/training-library');
    } finally {
      setLoading(false);
    }
  }
  
  // Handle picture file selection
  function handlePictureChange(e) {
    const files = Array.from(e.target.files);
    const maxPictures = 4;
    
    if (form.pictures.length + files.length > maxPictures) {
      showToast(`Maximum ${maxPictures} pictures allowed`, 'error');
      return;
    }
    
    setPictureFiles(prev => [...prev, ...files]);
    
    // Preview images
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(f => ({
          ...f,
          pictures: [...f.pictures, reader.result]
        }));
      };
      reader.readAsDataURL(file);
    });
  }
  
  // Remove picture
  function removePicture(index) {
    setForm(f => ({
      ...f,
      pictures: f.pictures.filter((_, i) => i !== index)
    }));
    setPictureFiles(prev => prev.filter((_, i) => i !== index));
  }
  
  
  // Upload pictures to Firebase Storage
  async function uploadPictures() {
    const uploadedUrls = [];
    
    for (let i = 0; i < pictureFiles.length; i++) {
      const file = pictureFiles[i];
      const storageRef = ref(storage, `trainings/${user.id}/${Date.now()}_${file.name}`);
      
      try {
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        uploadedUrls.push(url);
      } catch (error) {
        console.error('Error uploading picture:', error);
        throw error;
      }
    }
    
    return uploadedUrls;
  }
  
  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();
    
    // Validation
    if (!form.title.trim()) {
      showToast('Please enter a title', 'error');
      return;
    }
    
    if (form.categories.length === 0) {
      showToast('Please select at least one category', 'error');
      return;
    }
    
    try {
      setSaving(true);
      
      // Upload new pictures
      let pictureUrls = form.pictures.filter(p => p.startsWith('http')); // Keep existing URLs
      if (pictureFiles.length > 0) {
        const newUrls = await uploadPictures();
        pictureUrls = [...pictureUrls, ...newUrls];
      }
      
      const trainingData = {
        title: form.title.trim(),
        description: form.description.trim(),
        categories: form.categories,
        pictures: pictureUrls,
        ownerId: user.id,
        libraryType: 'personal'
      };
      
      if (isEditMode) {
        await updateTraining(id, trainingData);
        showToast('Training updated successfully', 'success');
      } else {
        await createTraining(trainingData);
        showToast('Training created successfully', 'success');
      }
      
      navigate('/training-library');
    } catch (error) {
      console.error('Error saving training:', error);
      showToast('Failed to save training', 'error');
    } finally {
      setSaving(false);
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light/60">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-4xl text-light mb-2">
          {isEditMode ? '✏️ Edit Training' : '+ New Training'}
        </h1>
        <p className="text-light/60 text-sm">
          {isEditMode ? 'Update your training plan' : 'Create a new training plan for your library'}
        </p>
      </div>
      
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <label className="block text-sm font-medium text-light/80 mb-2">
            Training Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Advanced Agility Drills"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            required
          />
        </div>
        
        {/* Description */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <label className="block text-sm font-medium text-light/80 mb-2">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe the training plan, objectives, and key exercises..."
            rows={6}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
        </div>
        
        {/* Categories */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <CategorySelector
            selectedCategories={form.categories}
            onChange={(categories) => setForm(f => ({ ...f, categories }))}
            required={true}
          />
          <p className="text-xs text-light/50 mt-2">Select one or more categories, or create your own custom category</p>
        </div>
        
        {/* Pictures */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <label className="block text-sm font-medium text-light/80 mb-3">
            Pictures (Max 4)
          </label>
          <p className="text-xs text-light/50 mb-4">Add pictures of drills or exercises</p>
          
          {/* Picture Upload */}
          <div className="mb-4">
            <label className="cursor-pointer">
              <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg hover:border-primary/50 transition-all bg-white/5">
                <div className="text-center">
                  <span className="text-3xl mb-2 block">📷</span>
                  <span className="text-sm text-light/60">Click to upload picture</span>
                  <span className="text-xs text-light/40 block mt-1">
                    JPG, PNG (Max 5MB)
                  </span>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handlePictureChange}
                className="hidden"
                disabled={form.pictures.length >= 4}
              />
            </label>
          </div>
          
          {/* Picture Preview */}
          {form.pictures.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {form.pictures.map((pic, index) => (
                <div key={index} className="relative group">
                  <img
                    src={pic}
                    alt={`Training ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removePicture(index)}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEditMode ? 'Update Training' : 'Create Training'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/training-library')}
            disabled={saving}
            className="px-6 py-3 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

