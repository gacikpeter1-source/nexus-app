// src/components/DeleteAccount.jsx
// Component for users to delete their own account (GDPR compliance)

import { useState } from 'react';
import { useNavigate } from 'router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getAllClubs, updateClub, getUser, deleteUser as deleteUserFromFirestore } from '../firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { auth } from '../firebase/config';

export default function DeleteAccount() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [step, setStep] = useState(1);

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') {
      showToast('Please type "DELETE MY ACCOUNT" to confirm', 'error');
      return;
    }

    setDeleting(true);

    try {
      setStep(2); // Removing from clubs

      // Get all clubs
      const allClubs = await getAllClubs();
      
      // Remove user from all clubs and teams
      for (const club of allClubs) {
        let clubUpdated = false;

        // Remove from club-level arrays
        if (club.members?.includes(user.id)) {
          club.members = club.members.filter(id => id !== user.id);
          clubUpdated = true;
        }
        if (club.trainers?.includes(user.id)) {
          club.trainers = club.trainers.filter(id => id !== user.id);
          clubUpdated = true;
        }
        if (club.assistants?.includes(user.id)) {
          club.assistants = club.assistants.filter(id => id !== user.id);
          clubUpdated = true;
        }

        // Remove from all teams in the club
        if (club.teams && Array.isArray(club.teams)) {
          club.teams = club.teams.map(team => {
            const updatedTeam = { ...team };
            
            if (updatedTeam.members?.includes(user.id)) {
              updatedTeam.members = updatedTeam.members.filter(id => id !== user.id);
              clubUpdated = true;
            }
            if (updatedTeam.trainers?.includes(user.id)) {
              updatedTeam.trainers = updatedTeam.trainers.filter(id => id !== user.id);
              clubUpdated = true;
            }
            if (updatedTeam.assistants?.includes(user.id)) {
              updatedTeam.assistants = updatedTeam.assistants.filter(id => id !== user.id);
              clubUpdated = true;
            }
            
            return updatedTeam;
          });
        }

        // Update club if changes were made
        if (clubUpdated) {
          await updateClub(club.id, club);
        }
      }

      setStep(3); // Deleting user data

      // Delete Firestore user document
      await deleteUserFromFirestore(user.id);

      setStep(4); // Deleting Firebase Auth account

      // Delete Firebase Auth account
      const currentUser = auth.currentUser;
      if (currentUser) {
        await deleteUser(currentUser);
      }

      setStep(5); // Complete

      showToast('Account successfully deleted', 'success');
      
      // Wait a bit then redirect
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (error) {
      console.error('Error deleting account:', error);
      showToast(`Failed to delete account: ${error.message}`, 'error');
      setDeleting(false);
      setStep(1);
    }
  };

  const getStepMessage = () => {
    switch (step) {
      case 2:
        return 'Removing you from all clubs and teams...';
      case 3:
        return 'Deleting your profile data...';
      case 4:
        return 'Removing authentication account...';
      case 5:
        return 'Account deleted successfully!';
      default:
        return '';
    }
  };

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium"
      >
        🗑️ Delete My Account
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-mid-dark border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-4xl">⚠️</span>
          <div>
            <h3 className="text-2xl font-bold text-red-400">Delete Account</h3>
            <p className="text-sm text-red-400/80">This action cannot be undone!</p>
          </div>
        </div>

        {!deleting ? (
          <>
            {/* Warning */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <h4 className="font-bold text-red-400 mb-2">What will be deleted:</h4>
              <ul className="text-sm text-red-400/80 space-y-1">
                <li>✓ Your profile and personal information</li>
                <li>✓ Your membership in all clubs and teams</li>
                <li>✓ Your private events and invitations</li>
                <li>✓ Your authentication account</li>
                <li>✓ All your data (GDPR compliant)</li>
              </ul>
            </div>

            {/* Confirmation */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-light/80 mb-2">
                Type <span className="text-red-400 font-bold">DELETE MY ACCOUNT</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full px-4 py-2 bg-dark border border-red-500/30 rounded-lg text-light focus:border-red-500 outline-none"
                placeholder="DELETE MY ACCOUNT"
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmText('');
                }}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={confirmText !== 'DELETE MY ACCOUNT'}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Forever
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Progress */}
            <div className="py-8">
              {/* Spinner */}
              <div className="flex justify-center mb-6">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500"></div>
              </div>

              {/* Status */}
              <div className="text-center">
                <p className="text-lg font-medium text-light mb-2">{getStepMessage()}</p>
                <div className="flex justify-center gap-2 mt-4">
                  <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-red-500' : 'bg-white/20'}`}></div>
                  <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-red-500' : 'bg-white/20'}`}></div>
                  <div className={`w-3 h-3 rounded-full ${step >= 4 ? 'bg-red-500' : 'bg-white/20'}`}></div>
                  <div className={`w-3 h-3 rounded-full ${step >= 5 ? 'bg-green-500' : 'bg-white/20'}`}></div>
                </div>
              </div>

              {step === 5 && (
                <div className="mt-6 text-center">
                  <p className="text-green-400">✓ Your account has been deleted</p>
                  <p className="text-sm text-light/60 mt-2">Redirecting to login...</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Info */}
        {!deleting && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-light/60 text-center">
              Note: If you are a club owner, please transfer ownership before deleting your account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
