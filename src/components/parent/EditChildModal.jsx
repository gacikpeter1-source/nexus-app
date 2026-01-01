// src/components/parent/EditChildModal.jsx
import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { updateChildProfile } from '../../firebase/parentChild';

export default function EditChildModal({ child, onClose, onSuccess }) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    firstName: child.firstName || '',
    lastName: child.lastName || '',
    allowBirthdateTracking: child.allowBirthdateTracking || false,
    birthdate: child.birthdate || ''
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const validate = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = t('common.required');
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = t('common.required');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    setLoading(true);
    try {
      await updateChildProfile(child.id, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        username: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        allowBirthdateTracking: formData.allowBirthdateTracking,
        birthdate: formData.allowBirthdateTracking ? formData.birthdate : null
      });
      
      showToast(t('profile.profileUpdated'), 'success');
      onSuccess();
    } catch (error) {
      console.error('Error updating child profile:', error);
      showToast(t('parentchild.errorAssigning'), 'error');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl max-w-lg w-full">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-light flex items-center gap-2">
              <span>✏️</span>
              {t('parentchild.editChild')}
            </h2>
            <button
              onClick={onClose}
              className="text-light/60 hover:text-light text-2xl"
            >
              ×
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Child Info Banner */}
          <div className="p-4 bg-blue-500/20 border border-blue-500/40 rounded-lg">
            <div className="text-sm text-blue-200">
              <div><strong>{t('parentchild.childOf')}:</strong> {child.managedByParentId ? 'You' : 'Linked'}</div>
              <div><strong>{t('common.email')}:</strong> {child.email}</div>
              {child.accountType && (
                <div><strong>{t('parentchild.accountType')}:</strong> {child.accountType}</div>
              )}
            </div>
          </div>
          
          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-light mb-2">
                {t('parentchild.childFirstName')} *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:border-primary"
                placeholder={t('parentchild.childFirstName')}
              />
              {errors.firstName && (
                <p className="text-red-400 text-sm mt-1">{errors.firstName}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-light mb-2">
                {t('parentchild.childLastName')} *
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:border-primary"
                placeholder={t('parentchild.childLastName')}
              />
              {errors.lastName && (
                <p className="text-red-400 text-sm mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>
          
          {/* Birthdate Tracking (Optional) */}
          <div>
            <label className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={formData.allowBirthdateTracking}
                onChange={(e) => setFormData({...formData, allowBirthdateTracking: e.target.checked})}
                className="w-4 h-4"
              />
              <span className="text-light text-sm">
                Track birthdate ({t('common.optional')})
              </span>
            </label>
            
            {formData.allowBirthdateTracking && (
              <input
                type="date"
                value={formData.birthdate || ''}
                onChange={(e) => setFormData({...formData, birthdate: e.target.value})}
                className="mt-2 w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:border-primary"
              />
            )}
          </div>
          
          {/* Read-only Info */}
          {child.accountType === 'subaccount' && (
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-sm text-light/60">
              <p>ℹ️ {t('parentchild.sameEmailInfo')}</p>
              <p className="mt-2">🔑 To change password, use "Manage Password" option</p>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg font-semibold transition-all"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


