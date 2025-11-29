// src/pages/Support.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Support() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [adminEmail, setAdminEmail] = useState('');
  const [form, setForm] = useState({
    subject: '',
    message: '',
    category: 'general',
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

    if (!form.subject.trim() || !form.message.trim()) {
      alert('Please fill in all fields');
      return;
    }

    // Create support ticket
    const ticket = {
      id: `ticket_${Date.now()}`,
      userId: user.id,
      userEmail: user.email,
      userName: user.displayName || user.username || user.email,
      category: form.category,
      subject: form.subject.trim(),
      message: form.message.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    // Save to localStorage (in production, this would be sent to backend)
    const tickets = JSON.parse(localStorage.getItem('support_tickets') || '[]');
    tickets.push(ticket);
    localStorage.setItem('support_tickets', JSON.stringify(tickets));

    setSubmitted(true);
    setForm({ subject: '', message: '', category: 'general' });

    // Show success message
    setTimeout(() => {
      setSubmitted(false);
    }, 5000);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-light">Please login to access support.</p>
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
            💬 SUPPORT
          </h1>
          <p className="text-light/60 text-lg mt-2">
            Get help from our admin team
          </p>
        </div>

        {submitted && (
          <div className="mb-6 p-4 bg-green-600/20 border border-green-600/30 rounded-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="text-green-400 font-semibold mb-1">Message Sent!</h3>
                <p className="text-green-400/80 text-sm">
                  Your support request has been submitted. Our admin team will respond to your email shortly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Admin Contact Info */}
        <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <span className="text-4xl">🛡️</span>
              <div>
                <h3 className="text-light font-title text-xl mb-2">Admin Contact</h3>
                {adminEmail ? (
                  <div className="space-y-2">
                    <p className="text-light/80 text-sm">
                      Your message will be sent to the application administrator:
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-semibold">{adminEmail}</span>
                      <a
                        href={`mailto:${adminEmail}`}
                        className="px-3 py-1 bg-primary/20 hover:bg-primary/30 text-primary rounded text-sm transition-all"
                      >
                        📧 Email Directly
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-light/60 text-sm">No admin contact available</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Support Form */}
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {/* Category */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label className="block text-light/80 mb-3 font-medium">Category *</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'general', label: 'General', icon: '💬' },
                { value: 'technical', label: 'Technical', icon: '⚙️' },
                { value: 'account', label: 'Account', icon: '👤' },
                { value: 'bug', label: 'Bug Report', icon: '🐛' },
              ].map(cat => (
                <label
                  key={cat.value}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg cursor-pointer transition-all border-2 ${
                    form.category === cat.value
                      ? 'bg-primary/20 border-primary'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    checked={form.category === cat.value}
                    onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                    className="hidden"
                  />
                  <span className="text-3xl">{cat.icon}</span>
                  <span className="text-light text-sm font-medium">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label className="block text-light/80 mb-2 font-medium">Subject *</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Brief description of your issue..."
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
          </div>

          {/* Message */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label className="block text-light/80 mb-2 font-medium">Message *</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Please describe your issue in detail..."
              rows={8}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              required
            />
            <p className="text-xs text-light/50 mt-2">
              Include as much detail as possible to help us assist you better.
            </p>
          </div>

          {/* Your Info */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-light font-medium mb-3">Your Information</h3>
            <div className="space-y-2 text-sm text-light/60">
              <div className="flex items-center gap-2">
                <span className="font-medium text-light/80">Name:</span>
                <span>{user.displayName || user.username || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-light/80">Email:</span>
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-light/80">Role:</span>
                <span className="capitalize">{user.role}</span>
              </div>
            </div>
            <p className="text-xs text-light/50 mt-3">
              This information will be included with your support request.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              className="flex-1 btn-primary py-4 text-lg font-semibold"
            >
              📨 Send Support Request
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

        {/* Help Tips */}
        <div className="mt-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-light font-title text-xl mb-4 flex items-center gap-2">
              <span>💡</span> Help Tips
            </h3>
            <ul className="space-y-3 text-light/80 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Choose the correct category for faster response</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Include screenshots if reporting a bug (attach via email)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Provide step-by-step details to reproduce issues</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Check your email for admin response</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
