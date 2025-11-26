// src/pages/Feedback.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Feedback() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [adminEmail, setAdminEmail] = useState('');
  const [form, setForm] = useState({
    type: 'suggestion',
    rating: 5,
    title: '',
    feedback: '',
  });

  const [submitted, setSubmitted] = useState(false);

  // Get SuperAdmin email
  useEffect(() => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const admin = users.find(u => u.role === 'admin');
    if (admin) {
      setAdminEmail(admin.email);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.feedback.trim()) {
      alert('Please fill in all fields');
      return;
    }

    // Create feedback entry
    const feedbackEntry = {
      id: `feedback_${Date.now()}`,
      userId: user.id,
      userEmail: user.email,
      userName: user.displayName || user.username || user.email,
      type: form.type,
      rating: form.rating,
      title: form.title.trim(),
      feedback: form.feedback.trim(),
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    // Save to localStorage (in production, this would be sent to backend)
    const feedbackList = JSON.parse(localStorage.getItem('user_feedback') || '[]');
    feedbackList.push(feedbackEntry);
    localStorage.setItem('user_feedback', JSON.stringify(feedbackList));

    setSubmitted(true);
    setForm({ type: 'suggestion', rating: 5, title: '', feedback: '' });

    // Show success message
    setTimeout(() => {
      setSubmitted(false);
    }, 5000);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-light">Please login to submit feedback.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-light/60 hover:text-light flex items-center gap-2 transition-colors"
          >
            ← Back
          </button>
          <h1 className="font-display text-5xl md:text-6xl text-light tracking-wider">
            📝 FEEDBACK
          </h1>
          <p className="text-light/60 text-lg mt-2">
            Share your thoughts and help us improve
          </p>
        </div>

        {submitted && (
          <div className="mb-6 p-4 bg-green-600/20 border border-green-600/30 rounded-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="text-green-400 font-semibold mb-1">Thank You!</h3>
                <p className="text-green-400/80 text-sm">
                  Your feedback has been submitted. We appreciate your input and will review it carefully.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Admin Contact */}
        {adminEmail && (
          <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="bg-gradient-to-r from-accent/20 to-secondary/20 border border-accent/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <span className="text-4xl">🛡️</span>
                <div>
                  <h3 className="text-light font-title text-xl mb-2">Feedback Recipient</h3>
                  <p className="text-light/80 text-sm mb-2">
                    Your feedback will be sent to the application administrator:
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-accent font-semibold">{adminEmail}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Form */}
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {/* Feedback Type */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label className="block text-light/80 mb-3 font-medium">Feedback Type *</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: 'suggestion', label: 'Suggestion', icon: '💡', desc: 'New feature idea' },
                { value: 'improvement', label: 'Improvement', icon: '⚡', desc: 'Enhance existing feature' },
                { value: 'praise', label: 'Praise', icon: '⭐', desc: 'Share what you love' },
              ].map(type => (
                <label
                  key={type.value}
                  className={`flex flex-col gap-2 p-4 rounded-lg cursor-pointer transition-all border-2 ${
                    form.type === type.value
                      ? 'bg-accent/20 border-accent'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={type.value}
                    checked={form.type === type.value}
                    onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{type.icon}</span>
                    <span className="text-light font-semibold">{type.label}</span>
                  </div>
                  <span className="text-light/60 text-xs">{type.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label className="block text-light/80 mb-3 font-medium">Overall Experience Rating *</label>
            <div className="flex items-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, rating: star }))}
                  className="text-4xl transition-all hover:scale-110"
                >
                  {star <= form.rating ? '⭐' : '☆'}
                </button>
              ))}
              <span className="ml-3 text-light/60">({form.rating}/5)</span>
            </div>
            <p className="text-xs text-light/50">
              Rate your overall experience with NEXUS
            </p>
          </div>

          {/* Title */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label className="block text-light/80 mb-2 font-medium">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Brief title for your feedback..."
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              required
            />
          </div>

          {/* Feedback */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label className="block text-light/80 mb-2 font-medium">Your Feedback *</label>
            <textarea
              value={form.feedback}
              onChange={(e) => setForm(f => ({ ...f, feedback: e.target.value }))}
              placeholder="Share your thoughts, ideas, or suggestions..."
              rows={8}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
              required
            />
            <p className="text-xs text-light/50 mt-2">
              Be specific and constructive. Your feedback helps us improve!
            </p>
          </div>

          {/* Your Info */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-light font-medium mb-3">Submitted By</h3>
            <div className="space-y-2 text-sm text-light/60">
              <div className="flex items-center gap-2">
                <span className="font-medium text-light/80">Name:</span>
                <span>{user.displayName || user.username || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-light/80">Email:</span>
                <span>{user.email}</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              className="flex-1 btn-primary py-4 text-lg font-semibold"
            >
              📨 Submit Feedback
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

        {/* Feedback Tips */}
        <div className="mt-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-light font-title text-xl mb-4 flex items-center gap-2">
              <span>💡</span> Feedback Tips
            </h3>
            <ul className="space-y-3 text-light/80 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>Be specific about what you like or want improved</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>Include examples or use cases for suggestions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>Explain how the change would benefit users</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>Keep feedback constructive and actionable</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
