// src/components/TransferOwnership.jsx
import React, { useState, useMemo } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function TransferOwnership({ club, onClose }) {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1); // 1: Select, 2: Confirm

  // Get list of trainers in this club (excluding current SuperTrainer)
  const availableTrainers = useMemo(() => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const clubTrainers = club.trainers || [];
    
    return users.filter(u => 
      clubTrainers.includes(u.id) && 
      u.id !== user.id && 
      u.role === ROLES.TRAINER
    );
  }, [club, user]);

  const selectedTrainer = useMemo(() => {
    if (!selectedTrainerId) return null;
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    return users.find(u => u.id === selectedTrainerId);
  }, [selectedTrainerId]);

  const handleSelectTrainer = () => {
    if (!selectedTrainerId) {
      showToast('Please select a trainer', 'error');
      return;
    }
    setStep(2);
  };

  const handleConfirmTransfer = async () => {
    if (confirmationText !== 'TRANSFER') {
      showToast('Please type TRANSFER to confirm', 'error');
      return;
    }

    setBusy(true);
    try {
      // Update club
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const clubIndex = clubs.findIndex(c => c.id === club.id);
      
      if (clubIndex === -1) throw new Error('Club not found');

      clubs[clubIndex].superTrainer = selectedTrainerId;
      clubs[clubIndex].previousSuperTrainers = [
        ...(clubs[clubIndex].previousSuperTrainers || []),
        {
          userId: user.id,
          transferredAt: new Date().toISOString(),
          transferredTo: selectedTrainerId
        }
      ];
      localStorage.setItem('clubs', JSON.stringify(clubs));

      // Update users
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      
      // Remove SuperTrainer status from current user
      const currentUserIndex = users.findIndex(u => u.id === user.id);
      if (currentUserIndex !== -1) {
        delete users[currentUserIndex].isSuperTrainer;
        delete users[currentUserIndex].superTrainerOf;
      }

      // Add SuperTrainer status to new user
      const newSuperTrainerIndex = users.findIndex(u => u.id === selectedTrainerId);
      if (newSuperTrainerIndex !== -1) {
        users[newSuperTrainerIndex].isSuperTrainer = true;
        users[newSuperTrainerIndex].superTrainerOf = club.id;
      }

      localStorage.setItem('users', JSON.stringify(users));

      // Update current user in localStorage
      const currentUser = JSON.parse(localStorage.getItem('currentUser'));
      delete currentUser.isSuperTrainer;
      delete currentUser.superTrainerOf;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      // Send notifications
      const mailbox = JSON.parse(localStorage.getItem('mailbox') || '[]');
      
      // Email to new SuperTrainer
      mailbox.unshift({
        id: `mail_${Date.now()}_1`,
        to: selectedTrainer.email,
        subject: 'You are now Club Owner!',
        body: `
Congratulations!

${user.username || user.email} has transferred ownership of "${club.name}" to you.

You are now the SuperTrainer (Club Owner) with full access to all teams.

Customer ID: ${club.customerID}
Club Code: ${club.clubCode}

This role comes with full administrative privileges for the entire club.

Welcome to club leadership!
        `,
        createdAt: Date.now()
      });

      // Confirmation email to previous owner
      mailbox.unshift({
        id: `mail_${Date.now()}_2`,
        to: user.email,
        subject: 'Ownership Transfer Confirmed',
        body: `
Your transfer of club ownership has been completed.

Club: ${club.name}
New Owner: ${selectedTrainer.username || selectedTrainer.email}
Date: ${new Date().toLocaleString()}

You will continue as a Trainer with access to your assigned teams.

Thank you for your leadership!
        `,
        createdAt: Date.now()
      });

      localStorage.setItem('mailbox', JSON.stringify(mailbox));

      showToast('Ownership transferred successfully!', 'success');
      
      if (typeof refreshUser === 'function') {
        await refreshUser();
      }

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      showToast(error.message || 'Transfer failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!club) {
    return <div className="text-light">No club selected</div>;
  }

  // Check if user is SuperTrainer
  const isSuperTrainer = club.superTrainer === user.id;

  if (!isSuperTrainer) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <p className="text-light/70">Only the SuperTrainer can transfer ownership.</p>
      </div>
    );
  }

  if (availableTrainers.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="font-title text-2xl text-light mb-4">Transfer Ownership</h3>
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <p className="text-warning font-semibold mb-2">⚠️ No Trainers Available</p>
          <p className="text-light/70 text-sm">
            You need at least one other Trainer in your club to transfer ownership.
          </p>
          <p className="text-light/70 text-sm mt-2">
            Add trainers to your club first, then you can transfer ownership to them.
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 max-w-2xl">
      {/* Step 1: Select Trainer */}
      {step === 1 && (
        <div className="animate-fade-in">
          <h3 className="font-title text-2xl text-light mb-4">Transfer Club Ownership</h3>
          
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-6">
            <p className="text-warning font-semibold mb-2">⚠️ Important</p>
            <p className="text-light/70 text-sm">
              Transferring ownership will give another trainer full SuperTrainer access to all teams in this club. 
              You will remain a Trainer but lose SuperTrainer privileges.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-light mb-3">Club Information</h4>
            <div className="space-y-2 text-sm text-light/70">
              <div className="flex justify-between">
                <span>Club Name:</span>
                <span className="font-medium text-light">{club.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer ID:</span>
                <span className="font-mono font-medium text-accent">{club.customerID}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Teams:</span>
                <span className="font-medium text-light">{club.teams?.length || 0}</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-light/80 font-medium mb-3">
              Select New SuperTrainer
            </label>
            <div className="space-y-2">
              {availableTrainers.map(trainer => (
                <div
                  key={trainer.id}
                  onClick={() => setSelectedTrainerId(trainer.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedTrainerId === trainer.id
                      ? 'bg-primary/20 border-primary'
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-light">
                        {trainer.username || trainer.email}
                      </div>
                      <div className="text-sm text-light/60">{trainer.email}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedTrainerId === trainer.id
                        ? 'border-primary bg-primary'
                        : 'border-white/30'
                    }`}>
                      {selectedTrainerId === trainer.id && (
                        <span className="text-white text-xs">✓</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSelectTrainer}
              disabled={!selectedTrainerId}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Confirmation */}
      {step === 2 && selectedTrainer && (
        <div className="animate-fade-in">
          <h3 className="font-title text-2xl text-light mb-4">Confirm Transfer</h3>
          
          <div className="bg-error/10 border border-error/30 rounded-lg p-4 mb-6">
            <p className="text-error font-semibold mb-2">⚠️ Final Confirmation</p>
            <p className="text-light/70 text-sm">
              This action cannot be undone. You will lose SuperTrainer privileges.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-light mb-3">Transfer Details</h4>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-light/60">From:</span>
                <div className="font-medium text-light mt-1">
                  {user.username || user.email} (You)
                </div>
              </div>
              <div className="border-t border-white/10 pt-3">
                <span className="text-light/60">To:</span>
                <div className="font-medium text-accent mt-1">
                  {selectedTrainer.username || selectedTrainer.email}
                </div>
                <div className="text-xs text-light/50">{selectedTrainer.email}</div>
              </div>
              <div className="border-t border-white/10 pt-3">
                <span className="text-light/60">Club:</span>
                <div className="font-medium text-light mt-1">{club.name}</div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-light/80 font-medium mb-2">
              Type <code className="text-error font-bold">TRANSFER</code> to confirm
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Type TRANSFER"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-error focus:ring-2 focus:ring-error/20 transition-all font-mono"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                setStep(1);
                setConfirmationText('');
              }}
              disabled={busy}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all font-medium disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleConfirmTransfer}
              disabled={busy || confirmationText !== 'TRANSFER'}
              className="flex-1 bg-error hover:bg-error/80 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Transferring...' : 'Transfer Ownership'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
