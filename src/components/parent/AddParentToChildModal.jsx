// src/components/parent/AddParentToChildModal.jsx
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getUserByEmail, getUser, getClub } from '../../firebase/firestore';
import { requestAdditionalParentLink } from '../../firebase/parentChild';

export default function AddParentToChildModal({ child, onClose, onSuccess }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchedParent, setSearchedParent] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const currentParentCount = (child.parentIds || []).length;
  const canAddMore = currentParentCount < 3;
  
  // Load all team members when modal opens
  useEffect(() => {
    loadTeamMembers();
  }, [child]);
  
  const loadTeamMembers = async () => {
    try {
      setLoadingMembers(true);
      const childClubIds = child.clubIds || [];
      const childTeamIds = child.teamIds || [];
      
      const allMembers = new Map();
      
      // Load all clubs where child is assigned
      for (const clubId of childClubIds) {
        const club = await getClub(clubId);
        if (!club) continue;
        
        // Get all teams where child is a member
        const relevantTeams = (club.teams || []).filter(team => 
          childTeamIds.includes(team.id)
        );
        
        // Collect all unique member IDs from these teams
        for (const team of relevantTeams) {
          const memberIds = [
            ...(team.members || []),
            ...(team.trainers || []),
            ...(team.assistants || [])
          ];
          
          for (const memberId of memberIds) {
            if (memberId === user.id) continue; // Skip current user
            if (child.parentIds && child.parentIds.includes(memberId)) continue; // Skip already linked parents
            
            if (!allMembers.has(memberId)) {
              const memberUser = await getUser(memberId);
              if (memberUser && memberUser.role === 'parent') {
                allMembers.set(memberId, memberUser);
              }
            }
          }
        }
      }
      
      setTeamMembers(Array.from(allMembers.values()));
    } catch (err) {
      console.error('Error loading team members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };
  
  // Filter team members based on search query
  const filteredMembers = teamMembers.filter(member => {
    const query = searchQuery.toLowerCase();
    return (
      member.username?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query) ||
      member.firstName?.toLowerCase().includes(query) ||
      member.lastName?.toLowerCase().includes(query)
    );
  });
  
  const handleSelectParent = async (selectedUser) => {
    setSearchQuery(selectedUser.email);
    setShowDropdown(false);
    setVerifying(true);
    setError('');
    
    try {
      // Validate the selected parent
      if (selectedUser.id === user.id) {
        setError('You are already linked to this child');
        setSearchedParent(null);
        return;
      }
      
      if (child.parentIds && child.parentIds.includes(selectedUser.id)) {
        setError('This parent is already linked to this child');
        setSearchedParent(null);
        return;
      }
      
      // Check if they share at least one team by checking actual club documents
      const childClubIds = child.clubIds || [];
      let sharedTeamsCount = 0;
      
      for (const clubId of childClubIds) {
        const club = await getClub(clubId);
        if (!club || !club.teams) continue;
        
        // Check each team in the club
        for (const team of club.teams) {
          const childInTeam = (team.members || []).includes(child.id) ||
                             (team.trainers || []).includes(child.id) ||
                             (team.assistants || []).includes(child.id);
          
          const parentInTeam = (team.members || []).includes(selectedUser.id) ||
                              (team.trainers || []).includes(selectedUser.id) ||
                              (team.assistants || []).includes(selectedUser.id);
          
          if (childInTeam && parentInTeam) {
            sharedTeamsCount++;
          }
        }
      }
      
      if (sharedTeamsCount === 0) {
        setError('This parent must be a member of at least one team where the child is assigned');
        setSearchedParent(null);
        return;
      }
      
      setSearchedParent(selectedUser);
      setError('');
    } catch (err) {
      console.error('Error validating parent:', err);
      setError('Failed to validate user');
      setSearchedParent(null);
    } finally {
      setVerifying(false);
    }
  };
  
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!searchedParent) {
      setError('Please search and verify a parent first');
      return;
    }
    
    setLoading(true);
    try {
      await requestAdditionalParentLink(user.id, child.id, searchedParent.id);
      showToast(t('parentchild.linkRequestSent'), 'success');
      onSuccess();
    } catch (err) {
      console.error('Error sending link request:', err);
      if (err.message === 'MAX_PARENTS_REACHED') {
        setError(t('parentchild.maxParents'));
      } else if (err.message === 'ALREADY_LINKED') {
        setError(t('parentchild.alreadyLinked'));
      } else {
        setError(t('parentchild.errorSendingRequest'));
      }
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
              <span>👨‍👩‍👧</span>
              Add Parent to {child.firstName}
            </h2>
            <button
              onClick={onClose}
              className="text-light/60 hover:text-light text-2xl"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Current Status */}
          <div className="p-4 bg-blue-500/20 border border-blue-500/40 rounded-lg">
            <p className="text-sm text-blue-200">
              👨‍👩‍👧‍👦 Current parents: {currentParentCount} / 3
            </p>
            {!canAddMore && (
              <p className="text-sm text-yellow-200 mt-2">
                ⚠️ {t('parentchild.maxParents')}
              </p>
            )}
          </div>
          
          {canAddMore && (
            <>
              {/* Info Banner */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <h4 className="font-semibold text-light mb-2 flex items-center gap-2">
                  <span>📋</span>
                  Requirements for Additional Parent:
                </h4>
                <ul className="space-y-1 text-sm text-light/70 list-disc list-inside">
                  <li>User must have "parent" role (assigned by trainer)</li>
                  <li>Must be member of at least one team where {child.firstName} is assigned</li>
                  <li>The new parent must approve the link request</li>
                  <li>Once approved, both parents will have full control over {child.firstName}</li>
                </ul>
              </div>
              
              {/* Search Form */}
              <div className="relative">
                <label className="block text-sm font-medium text-light mb-2">
                  Search Parent by Name or Email
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                      setError('');
                      setSearchedParent(null);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:border-primary"
                    placeholder="Type name or email to search..."
                    disabled={loading || verifying || loadingMembers}
                  />
                  {loadingMembers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                    </div>
                  )}
                </div>
                
                {/* Dropdown with filtered results */}
                {showDropdown && searchQuery && filteredMembers.length > 0 && !searchedParent && (
                  <div className="absolute z-10 w-full mt-1 bg-dark-bg border border-white/20 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                    {filteredMembers.slice(0, 10).map(member => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelectParent(member)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left border-b border-white/5 last:border-b-0"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          {member.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-light truncate">{member.username}</div>
                          <div className="text-sm text-light/60 truncate">{member.email}</div>
                        </div>
                        <div className="flex-shrink-0">
                          <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                            👨‍👩‍👧 parent
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* No results message */}
                {showDropdown && searchQuery && filteredMembers.length === 0 && !loadingMembers && (
                  <div className="absolute z-10 w-full mt-1 bg-dark-bg border border-white/20 rounded-lg shadow-2xl p-4">
                    <p className="text-light/60 text-sm text-center">
                      No parents found in {child.firstName}'s teams
                    </p>
                  </div>
                )}
                
                {/* Team members info */}
                {!loadingMembers && teamMembers.length > 0 && !searchQuery && (
                  <p className="text-xs text-light/50 mt-2">
                    {teamMembers.length} parent(s) available from shared teams
                  </p>
                )}
                
                {error && (
                  <p className="text-red-400 text-sm mt-2">{error}</p>
                )}
              </div>
              
              {/* Found Parent */}
              {searchedParent && (
                <div className="p-4 bg-green-500/20 border border-green-500/40 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        {searchedParent.username?.[0] || '?'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-light">{searchedParent.username}</h4>
                        <p className="text-sm text-light/60">{searchedParent.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchedParent(null);
                        setSearchQuery('');
                        setError('');
                      }}
                      className="text-red-400 hover:text-red-300 transition-colors px-2"
                      title="Clear selection"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-200">
                    <span>✅</span>
                    <span>Eligible to be linked as additional parent</span>
                  </div>
                </div>
              )}
              
              {/* Submit */}
              {searchedParent && (
                <form onSubmit={handleSubmit}>
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
                    <h4 className="font-semibold text-light mb-2 flex items-center gap-2">
                      <span>📋</span>
                      Approval Process
                    </h4>
                    <ul className="space-y-2 text-sm text-light/70">
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span><strong>You</strong> (Parent 1) - Automatically approved</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-0.5">⏳</span>
                        <span><strong>{searchedParent.username}</strong> (Parent 2) - Must approve the link request</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">ℹ️</span>
                        <span>The child account has no separate email, so only the new parent needs to approve</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          {t('common.loading')}
                        </>
                      ) : (
                        <>
                          <span>📧</span>
                          Send Link Request to {searchedParent.firstName || searchedParent.username}
                        </>
                      )}
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
              )}
            </>
          )}
          
          {!canAddMore && (
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg font-semibold transition-all"
              >
                {t('common.close')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

