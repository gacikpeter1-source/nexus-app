// src/components/parent/ChildAccountCreationModal.jsx
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createChildAccount } from '../../firebase/parentChild';
import { getUser, getClub } from '../../firebase/firestore';

export default function ChildAccountCreationModal({ onClose, onSuccess }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    teamIds: [],
    clubIds: [],
    profilePicture: null,
    allowBirthdateTracking: false,
    birthdate: null
  });
  
  const [parentTeams, setParentTeams] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);
  
  useEffect(() => {
    loadParentTeams();
  }, [user]);
  
  const loadParentTeams = async () => {
    try {
      setLoadingTeams(true);
      const userData = await getUser(user.id);
      
      // Get teams where parent is a member
      const allTeams = [];
      const clubIds = userData.clubIds || [];
      
      // Fetch teams from all clubs where parent is a member
      for (const clubId of clubIds) {
        try {
          const club = await getClub(clubId);
          if (club && club.teams) {
            // Get teams where user is a member, trainer, or assistant
            const userTeams = club.teams.filter(team => {
              const isMember = (team.members || []).includes(user.id);
              const isTrainer = (team.trainers || []).includes(user.id);
              const isAssistant = (team.assistants || []).includes(user.id);
              return isMember || isTrainer || isAssistant;
            });
            
            // Add club info to each team for display
            userTeams.forEach(team => {
              allTeams.push({
                ...team,
                clubId: clubId,
                clubName: club.name,
                displayName: `${team.name} (${club.name})`
              });
            });
          }
        } catch (clubError) {
          console.error(`Error loading club ${clubId}:`, clubError);
          // Continue with other clubs
        }
      }
      
      setParentTeams(allTeams);
      setFormData(prev => ({ ...prev, clubIds }));
    } catch (error) {
      console.error('Error loading parent teams:', error);
      showToast(t('common.error'), 'error');
    } finally {
      setLoadingTeams(false);
    }
  };
  
  const validate = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = t('common.required');
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = t('common.required');
    }
    
    if (!formData.password) {
      newErrors.password = t('common.required');
    } else if (formData.password.length < 6) {
      newErrors.password = t('parentchild.passwordTooShort');
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('parentchild.passwordMismatch');
    }
    
    if (formData.teamIds.length === 0) {
      newErrors.teams = t('parentchild.selectAtLeastOneTeam');
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
      const result = await createChildAccount(user.id, formData);
      
      if (result.needsApproval && result.joinRequests.length > 0) {
        // Child created and join requests submitted
        const teamNames = result.joinRequests.map(r => r.teamName).join(', ');
        showToast(
          `${t('parentchild.childCreatedSuccessfully')} - Join requests sent for: ${teamNames}. Awaiting trainer approval.`,
          'success'
        );
      } else {
        showToast(t('parentchild.childCreatedSuccessfully'), 'success');
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error creating child:', error);
      
      if (error.message === 'USER_NOT_PARENT') {
        showToast(t('parentchild.notParent'), 'error');
      } else {
        showToast(t('parentchild.errorCreatingChild'), 'error');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const toggleTeam = (teamId) => {
    setFormData(prev => ({
      ...prev,
      teamIds: prev.teamIds.includes(teamId)
        ? prev.teamIds.filter(id => id !== teamId)
        : [...prev.teamIds, teamId]
    }));
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-light flex items-center gap-2">
              <span>➕</span>
              {t('parentchild.createChildTitle')}
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
          {/* Info Banner */}
          <div className="p-4 bg-blue-500/20 border border-blue-500/40 rounded-lg space-y-2">
            <p className="text-sm text-blue-200">💡 {t('parentchild.sameEmailInfo')}</p>
            <p className="text-sm text-blue-200">🔑 {t('parentchild.passwordInfo')}</p>
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
          
          {/* Password Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-light mb-2">
                {t('parentchild.childPassword')} *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:border-primary"
                placeholder={t('changePassword.minLength')}
              />
              {errors.password && (
                <p className="text-red-400 text-sm mt-1">{errors.password}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-light mb-2">
                {t('auth.confirmPassword')} *
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:border-primary"
                placeholder={t('auth.confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          </div>
          
          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              {t('parentchild.selectTeamsFor').replace('{name}', formData.firstName || 'child')} *
            </label>
            <p className="text-xs text-light/60 mb-3">
              {t('parentchild.onlyParentTeams')}
            </p>
            
            {loadingTeams ? (
              <div className="text-center py-4 text-light/60">{t('common.loading')}</div>
            ) : parentTeams.length === 0 ? (
              <div className="p-4 bg-yellow-500/20 border border-yellow-500/40 rounded-lg">
                <p className="text-sm text-yellow-200">
                  ⚠️ {t('parentchild.noTeamsAvailable')}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {parentTeams.map(team => (
                  <label
                    key={team.id}
                    className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={formData.teamIds.includes(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="text-light">{team.displayName || team.name}</span>
                      {team.clubName && (
                        <span className="text-xs text-light/50 ml-2">• {team.clubName}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
            
            {errors.teams && (
              <p className="text-red-400 text-sm mt-1">{errors.teams}</p>
            )}
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
          
          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={loading || loadingTeams || parentTeams.length === 0}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('common.create')}
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

