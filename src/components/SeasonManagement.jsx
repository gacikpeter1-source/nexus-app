// src/components/SeasonManagement.jsx
import { useState, useEffect } from 'react';
import { useSeasons } from '../contexts/SeasonContext';
import { migrateGamesToSeasons, hasUnassignedGames } from '../firebase/firestore';

export default function SeasonManagement({ clubId, onClose }) {
  const { seasons, createSeason, updateSeason, deleteSeason, archiveSeason, loadSeasons } = useSeasons();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [hasUnmigrated, setHasUnmigrated] = useState(false);

  // Load seasons when component mounts
  useEffect(() => {
    if (clubId) {
      loadSeasons(clubId);
      checkUnmigratedGames();
    }
  }, [clubId]);

  // Check if there are games without seasonId
  const checkUnmigratedGames = async () => {
    try {
      const hasUnassigned = await hasUnassignedGames(clubId);
      setHasUnmigrated(hasUnassigned);
    } catch (error) {
      console.error('Error checking for unmigrated games:', error);
    }
  };

  // Handle migration
  const handleMigration = async () => {
    if (!window.confirm('This will assign seasons to all games that don\'t have one. Continue?')) {
      return;
    }

    try {
      setMigrating(true);
      const result = await migrateGamesToSeasons(clubId);
      alert(`Migration complete!\n${result.migrated} games migrated\n${result.skipped} games already had seasons`);
      setHasUnmigrated(false);
    } catch (error) {
      console.error('Error migrating games:', error);
      alert('Failed to migrate games. Please try again.');
    } finally {
      setMigrating(false);
    }
  };

  const handleCreateSeason = () => {
    setEditingSeason(null);
    setShowCreateModal(true);
  };

  const handleEditSeason = (season) => {
    setEditingSeason(season);
    setShowCreateModal(true);
  };

  const handleArchive = async (seasonId) => {
    if (!window.confirm('Archive this season? It will still be visible but marked as archived.')) {
      return;
    }

    try {
      setLoading(true);
      await archiveSeason(seasonId);
    } catch (error) {
      console.error('Error archiving season:', error);
      alert('Failed to archive season');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (seasonId) => {
    if (!window.confirm('Are you sure? This will delete the season. Games will remain but will need to be reassigned to another season.')) {
      return;
    }

    try {
      setLoading(true);
      // TODO: Check if games are linked to this season
      // For now, just delete
      await deleteSeason(seasonId);
    } catch (error) {
      console.error('Error deleting season:', error);
      alert('Failed to delete season');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 sticky top-0 bg-mid-dark z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">Season Management</h3>
              <p className="text-sm text-light/60 mt-1">Create and manage seasons for your club</p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-light/60 hover:text-light transition text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Create Button & Migration */}
          <div className="mb-6 flex items-center gap-4 flex-wrap">
            <button
              onClick={handleCreateSeason}
              className="btn-primary px-6 py-3"
              disabled={loading}
            >
              ➕ Create New Season
            </button>

            {hasUnmigrated && (
              <button
                onClick={handleMigration}
                disabled={migrating}
                className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {migrating ? '⏳ Migrating...' : '🔄 Migrate Existing Games to Seasons'}
              </button>
            )}
          </div>

          {/* Seasons Table */}
          {seasons.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-light/60 text-lg mb-4">No seasons created yet</p>
              <button
                onClick={handleCreateSeason}
                className="btn-primary px-6 py-2"
              >
                Create First Season
              </button>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-light">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left py-3 px-4 font-semibold">Season</th>
                    <th className="text-left py-3 px-4 font-semibold">Start Date</th>
                    <th className="text-left py-3 px-4 font-semibold">End Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {seasons.map((season) => (
                    <tr key={season.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{season.displayName || season.name}</p>
                          {season.description && (
                            <p className="text-xs text-light/50 mt-1">{season.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{formatDate(season.startDate)}</td>
                      <td className="py-3 px-4">{formatDate(season.endDate)}</td>
                      <td className="py-3 px-4">
                        {season.status === 'active' && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs border border-green-500/30">
                            Active
                          </span>
                        )}
                        {season.status === 'archived' && (
                          <span className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded text-xs border border-gray-500/30">
                            Archived
                          </span>
                        )}
                        {season.status === 'upcoming' && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs border border-blue-500/30">
                            Upcoming
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditSeason(season)}
                            className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded transition-colors text-xs"
                            disabled={loading}
                          >
                            Edit
                          </button>
                          {season.status !== 'archived' && (
                            <button
                              onClick={() => handleArchive(season.id)}
                              className="px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded transition-colors text-xs"
                              disabled={loading}
                            >
                              Archive
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(season.id)}
                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded transition-colors text-xs"
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Season Modal */}
      {showCreateModal && (
        <SeasonFormModal
          clubId={clubId}
          season={editingSeason}
          existingSeasons={seasons}
          onSave={async (seasonData) => {
            try {
              if (editingSeason) {
                await updateSeason(editingSeason.id, seasonData);
              } else {
                await createSeason({ ...seasonData, clubId });
              }
              setShowCreateModal(false);
              setEditingSeason(null);
            } catch (error) {
              console.error('Error saving season:', error);
              throw error;
            }
          }}
          onClose={() => {
            setShowCreateModal(false);
            setEditingSeason(null);
          }}
        />
      )}
    </div>
  );
}

// Season Form Modal Component
function SeasonFormModal({ clubId, season, existingSeasons, onSave, onClose }) {
  const isEditing = !!season;

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    startDate: '',
    endDate: '',
    status: 'active',
    description: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Pre-fill form if editing
  useEffect(() => {
    if (season) {
      setFormData({
        name: season.name || '',
        displayName: season.displayName || '',
        startDate: season.startDate || '',
        endDate: season.endDate || '',
        status: season.status || 'active',
        description: season.description || ''
      });
    }
  }, [season]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Season name is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    // Check if trying to activate a second season
    if (formData.status === 'active') {
      const otherActiveSeason = existingSeasons.find(
        s => s.status === 'active' && s.id !== season?.id
      );
      if (otherActiveSeason) {
        newErrors.status = `Another season "${otherActiveSeason.name}" is already active. Please archive it first.`;
      }
    }

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
      const seasonData = {
        name: formData.name.trim(),
        displayName: formData.displayName.trim() || null,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        description: formData.description.trim() || null,
        createdBy: season?.createdBy || 'user'
      };

      await onSave(seasonData);
    } catch (error) {
      console.error('Error saving season:', error);
      setErrors({ submit: 'Failed to save season. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 sticky top-0 bg-mid-dark z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">
                {isEditing ? '✏️ Edit Season' : '➕ Create Season'}
              </h3>
              <p className="text-sm text-light/60 mt-1">
                {isEditing ? 'Update season details' : 'Add a new season to your club'}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="text-light/60 hover:text-light transition text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* General Error */}
          {errors.submit && (
            <div className="bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg p-4 text-sm">
              {errors.submit}
            </div>
          )}

          {/* Season Name */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Season Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., 2024-2025"
              className={`w-full bg-white/10 border ${
                errors.name ? 'border-red-500' : 'border-white/20'
              } rounded-lg px-4 py-3 text-light placeholder:text-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
              disabled={saving}
            />
            {errors.name && (
              <p className="text-red-400 text-sm mt-2">{errors.name}</p>
            )}
            <p className="text-xs text-light/50 mt-2">
              Short name for internal use (e.g., "2024-2025", "Fall 2024")
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Display Name (Optional)
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => handleChange('displayName', e.target.value)}
              placeholder="e.g., Season 2024/2025"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder:text-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              disabled={saving}
            />
            <p className="text-xs text-light/50 mt-2">
              Friendly name shown to users (defaults to season name if not provided)
            </p>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">
                Start Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className={`w-full bg-white/10 border ${
                  errors.startDate ? 'border-red-500' : 'border-white/20'
                } rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
                disabled={saving}
              />
              {errors.startDate && (
                <p className="text-red-400 text-sm mt-2">{errors.startDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">
                End Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
                className={`w-full bg-white/10 border ${
                  errors.endDate ? 'border-red-500' : 'border-white/20'
                } rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
                disabled={saving}
              />
              {errors.endDate && (
                <p className="text-red-400 text-sm mt-2">{errors.endDate}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Status
            </label>
            <div className="flex gap-4">
              {['active', 'upcoming', 'archived'].map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value={status}
                    checked={formData.status === status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-4 h-4 text-primary focus:ring-primary"
                    disabled={saving}
                  />
                  <span className="text-light capitalize">{status}</span>
                </label>
              ))}
            </div>
            {errors.status && (
              <p className="text-red-400 text-sm mt-2">{errors.status}</p>
            )}
            <p className="text-xs text-light/50 mt-2">
              Only one season can be active at a time
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="e.g., Main league season"
              rows={3}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder:text-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              disabled={saving}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? '💾 Update Season' : '➕ Create Season')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

