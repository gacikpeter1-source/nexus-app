// src/components/EditMemberCardModal.jsx - FINAL with Image Upload & Crop
import { useState, useEffect } from 'react';
import { handleImageUpload } from '../utils/imageUpload';
import ImageCropModal from './ImageCropModal';

export default function EditMemberCardModal({ 
  member, 
  team,
  teamId,
  teamMemberData = {},
  onSave, 
  onClose 
}) {
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Image upload states
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [useMainProfile, setUseMainProfile] = useState(false); // Changed to false!
  
  // Crop modal states
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);

  const customFields = Array.isArray(team.customFields) ? team.customFields : [];

  useEffect(() => {
    const initialData = {};
    customFields.forEach(field => {
      initialData[field.key] = teamMemberData[field.key] || '';
    });
    
    // Set image preferences - FIXED
    if (teamMemberData.profileImage) {
      // User has uploaded a team-specific image
      setImagePreview(teamMemberData.profileImage);
      setUseMainProfile(false);
    } else if (member.profileImage) {
      // Use main profile image as default
      setImagePreview(member.profileImage);
      setUseMainProfile(true);
    } else {
      // No image at all
      setImagePreview(null);
      setUseMainProfile(false);
    }
    
    setFormData(initialData);
  }, [customFields, teamMemberData, member.profileImage]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert(error.message);
      setUploadingImage(false);
    }
  };

  const handleCropComplete = (croppedBase64) => {
    setImagePreview(croppedBase64);
    setUseMainProfile(false);
    setShowCropModal(false);
    setCropImageSrc(null);
    setUploadingImage(false);
  };

  const validateForm = () => {
    const newErrors = {};
    
    customFields.forEach(field => {
      if (field.required && !formData[field.key]?.toString().trim()) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    
    try {
      const saveData = {
        ...formData,
        profileImage: !useMainProfile && imagePreview ? imagePreview : null,
        useMainProfile: useMainProfile
      };
      
      await onSave(member.id, saveData);
      onClose();
    } catch (error) {
      console.error('Error saving member card data:', error);
      alert('Failed to save card data');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field) => {
    const value = formData[field.key] || '';
    const hasError = errors[field.key];

    switch (field.type) {
      case 'text':
        return (
          <div key={field.key}>
            <label className="block text-sm font-medium text-light/80 mb-2">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setFormData({...formData, [field.key]: e.target.value});
                setErrors({...errors, [field.key]: ''});
              }}
              className={`w-full bg-white/10 border rounded-lg px-4 py-3 text-light placeholder-light/40 focus:ring-2 transition ${
                hasError 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                  : 'border-white/20 focus:border-primary focus:ring-primary/20'
              }`}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {hasError && (
              <p className="text-red-400 text-xs mt-1">{hasError}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.key}>
            <label className="block text-sm font-medium text-light/80 mb-2">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => {
                setFormData({...formData, [field.key]: e.target.value});
                setErrors({...errors, [field.key]: ''});
              }}
              className={`w-full bg-white/10 border rounded-lg px-4 py-3 text-light placeholder-light/40 focus:ring-2 transition ${
                hasError 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                  : 'border-white/20 focus:border-primary focus:ring-primary/20'
              }`}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {hasError && (
              <p className="text-red-400 text-xs mt-1">{hasError}</p>
            )}
          </div>
        );

      case 'dropdown':
        return (
          <div key={field.key}>
            <label className="block text-sm font-medium text-light/80 mb-2">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => {
                setFormData({...formData, [field.key]: e.target.value});
                setErrors({...errors, [field.key]: ''});
              }}
              className={`w-full bg-white/10 border rounded-lg px-4 py-3 text-light focus:ring-2 transition ${
                hasError 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                  : 'border-white/20 focus:border-primary focus:ring-primary/20'
              }`}
            >
              <option value="">Select {field.label.toLowerCase()}...</option>
              {field.options?.map((option, idx) => (
                <option key={idx} value={option}>{option}</option>
              ))}
            </select>
            {hasError && (
              <p className="text-red-400 text-xs mt-1">{hasError}</p>
            )}
          </div>
        );

      case 'range':
        return (
          <div key={field.key}>
            <label className="block text-sm font-medium text-light/80 mb-2">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={value}
                onChange={(e) => {
                  setFormData({...formData, [field.key]: e.target.value});
                  setErrors({...errors, [field.key]: ''});
                }}
                className={`flex-1 bg-white/10 border rounded-lg px-4 py-3 text-light placeholder-light/40 focus:ring-2 transition ${
                  hasError 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                    : 'border-white/20 focus:border-primary focus:ring-primary/20'
                }`}
              />
              <span className="text-light/60 text-sm font-medium">{value || '0'}</span>
            </div>
            {hasError && (
              <p className="text-red-400 text-xs mt-1">{hasError}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">
                Edit Team Card: {member.username}
              </h3>
              <p className="text-sm text-light/60 mt-1">
                {team.name} - Team-specific information
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Profile Picture (Circle) */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h4 className="font-semibold text-light mb-3">Profile Picture (Circle)</h4>
            <p className="text-xs text-light/50 mb-3">This photo will appear in the blue circle on the card</p>
            
            {/* Image Preview */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary">
                {imagePreview ? (
                  <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl font-bold">
                    {member.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={useMainProfile}
                  />
                  <div className={`px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg cursor-pointer inline-flex items-center gap-2 text-sm ${
                    useMainProfile ? 'opacity-50 cursor-not-allowed' : ''
                  }`}>
                    {uploadingImage ? '⏳ Uploading...' : '📤 Upload Team Photo'}
                  </div>
                </label>
                <p className="text-xs text-light/50 mt-2">
                  Upload a team-specific photo (max 5MB)
                </p>
              </div>
            </div>

            {/* Use Main Profile Toggle */}
            {member.profileImage && (
              <label className="flex items-center gap-2 text-light/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMainProfile}
                  onChange={(e) => {
                    setUseMainProfile(e.target.checked);
                    if (e.target.checked) {
                      setImagePreview(member.profileImage);
                    } else {
                      setImagePreview(teamMemberData.profileImage || null);
                    }
                  }}
                  className="rounded"
                />
                Use main profile picture
              </label>
            )}
          </div>

          {/* Dynamic Fields */}
          {customFields.length === 0 ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-8 text-center">
              <p className="text-yellow-300 mb-2">⚠️ No fields configured</p>
              <p className="text-yellow-200/60 text-sm">
                Trainers need to configure custom fields for this team first.
              </p>
            </div>
          ) : (
            (customFields || []).map(field => renderField(field))
          )}


          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              💡 This information is specific to <strong>{team.name}</strong> only. 
              You can have different details and photos in other teams.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving || (customFields.length === 0 && useMainProfile)}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : '💾 Save Card Data'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg transition"
            >
              Cancel
            </button>
          </div>

          {/* Image Crop Modal */}
          {showCropModal && cropImageSrc && (
            <ImageCropModal
              image={cropImageSrc}
              onComplete={handleCropComplete}
              onCancel={() => {
                setShowCropModal(false);
                setCropImageSrc(null);
                setUploadingImage(false);
              }}
              title="Adjust Profile Picture"
              aspectRatio={1}
            />
          )}

        </form>
      </div>
    </div>
  );
}
