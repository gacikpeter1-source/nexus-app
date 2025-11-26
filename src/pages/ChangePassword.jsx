// src/pages/ChangePassword.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ChangePassword() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    // Validation
    if (!form.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!form.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (form.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (form.newPassword !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Get users from localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.id === user.id);

    if (userIndex === -1) {
      alert('User not found');
      return;
    }

    // Check current password
    if (users[userIndex].password !== form.currentPassword) {
      setErrors({ currentPassword: 'Current password is incorrect' });
      return;
    }

    // Update password
    users[userIndex].password = form.newPassword;
    localStorage.setItem('users', JSON.stringify(users));

    // Update currentUser
    const updatedUser = { ...user, password: form.newPassword };
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));

    alert('Password changed successfully!');
    navigate('/profile');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-light">Please login to change your password.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-light/60 hover:text-light flex items-center gap-2 transition-colors"
          >
            ← Back
          </button>
          <h1 className="font-display text-5xl md:text-6xl text-light tracking-wider">
            🔒 CHANGE PASSWORD
          </h1>
          <p className="text-light/60 text-lg mt-2">
            Update your account password
          </p>
        </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {/* Current Password */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label className="block text-sm font-medium text-light/80 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => {
                setForm(f => ({ ...f, currentPassword: e.target.value }));
                setErrors(e => ({ ...e, currentPassword: '' }));
              }}
              placeholder="Enter your current password"
              className={`w-full bg-white/10 border ${
                errors.currentPassword ? 'border-red-500' : 'border-white/20'
              } rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
            />
            {errors.currentPassword && (
              <p className="text-red-400 text-sm mt-2">{errors.currentPassword}</p>
            )}
          </div>

          {/* New Password */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label className="block text-sm font-medium text-light/80 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => {
                setForm(f => ({ ...f, newPassword: e.target.value }));
                setErrors(e => ({ ...e, newPassword: '' }));
              }}
              placeholder="Enter your new password"
              className={`w-full bg-white/10 border ${
                errors.newPassword ? 'border-red-500' : 'border-white/20'
              } rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
            />
            {errors.newPassword && (
              <p className="text-red-400 text-sm mt-2">{errors.newPassword}</p>
            )}
            <p className="text-xs text-light/50 mt-2">
              Must be at least 6 characters long
            </p>
          </div>

          {/* Confirm Password */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label className="block text-sm font-medium text-light/80 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => {
                setForm(f => ({ ...f, confirmPassword: e.target.value }));
                setErrors(e => ({ ...e, confirmPassword: '' }));
              }}
              placeholder="Confirm your new password"
              className={`w-full bg-white/10 border ${
                errors.confirmPassword ? 'border-red-500' : 'border-white/20'
              } rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
            />
            {errors.confirmPassword && (
              <p className="text-red-400 text-sm mt-2">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Save Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              className="flex-1 btn-primary py-4 text-lg font-semibold"
            >
              🔒 Change Password
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-4 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
