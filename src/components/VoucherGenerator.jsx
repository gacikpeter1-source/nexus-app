// src/components/VoucherGenerator.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createVoucher, getAllVouchers, deleteVoucher } from '../firebase/firestore';

export default function VoucherGenerator() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [plan, setPlan] = useState('trial');
  const [duration, setDuration] = useState(30); // days
  const [maxUses, setMaxUses] = useState(1);
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    try {
      setLoading(true);
      const allVouchers = await getAllVouchers();
      setVouchers(allVouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error('Error loading vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateVoucherCode = (plan, expirationDate, duration) => {
    // Format: PLAN-RANDOM-EXPIRY-DURATION
    // Example: TRIAL-A7F9-20251231-30D
    
    const planCode = plan.substring(0, 4).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const expiry = expirationDate.toISOString().split('T')[0].replace(/-/g, '').substring(2); // YYMMDD
    const durationCode = `${duration}D`;
    
    return `${planCode}-${random}-${expiry}-${durationCode}`;
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      showToast('Please provide a description', 'error');
      return;
    }

    try {
      setGenerating(true);

      // Calculate expiration date
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + parseInt(duration));

      // Generate unique code
      const code = generateVoucherCode(plan, expirationDate, duration);

      // Create voucher
      const voucherData = {
        code,
        plan,
        duration: parseInt(duration),
        expirationDate: expirationDate.toISOString(),
        maxUses: parseInt(maxUses),
        usedCount: 0,
        usedBy: [],
        status: 'active',
        description: description.trim(),
        createdBy: user.id,
        createdAt: new Date().toISOString()
      };

      await createVoucher(voucherData);
      showToast('Voucher created successfully!', 'success');
      
      // Reset form
      setDescription('');
      setPlan('trial');
      setDuration(30);
      setMaxUses(1);
      
      // Reload vouchers
      loadVouchers();

    } catch (error) {
      console.error('Error generating voucher:', error);
      showToast('Failed to generate voucher', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (voucherId) => {
    if (!window.confirm('Delete this voucher?')) return;

    try {
      await deleteVoucher(voucherId);
      showToast('Voucher deleted', 'success');
      loadVouchers();
    } catch (error) {
      console.error('Error deleting voucher:', error);
      showToast('Failed to delete voucher', 'error');
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    showToast('Voucher code copied!', 'success');
  };

  if (!user || (!user.isSuperAdmin && user.role !== 'admin')) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
        <p className="text-light/70">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-title text-3xl text-light">Voucher Generator</h2>
        <button
          onClick={loadVouchers}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Generator Form */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h3 className="text-xl font-bold text-light mb-4">Create New Voucher</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Plan Selection */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Plan Type
            </label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:outline-none"
              style={{ colorScheme: 'dark' }}
            >
              <option value="trial" className="bg-dark text-light">Trial (All Features)</option>
              <option value="user" className="bg-dark text-light">User Subscription</option>
              <option value="club" className="bg-dark text-light">Club Subscription</option>
              <option value="full" className="bg-dark text-light">Full Subscription</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Duration (Days)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              max="365"
              className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:outline-none"
            />
          </div>

          {/* Max Uses */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Max Uses
            </label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              min="1"
              max="1000"
              className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:outline-none"
            />
            <p className="text-xs text-light/50 mt-1">
              How many users can use this code
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Q1 2025 Trial Campaign"
              className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light placeholder:text-light/40 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-light/60 mb-1">Preview Code:</p>
              <p className="font-mono text-accent text-lg font-bold">
                {generateVoucherCode(plan, new Date(Date.now() + duration * 24 * 60 * 60 * 1000), duration)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-light/60">Expires:</p>
              <p className="text-light font-medium">
                {new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
        >
          {generating ? 'Generating...' : '🎫 Generate Voucher'}
        </button>
      </div>

      {/* Vouchers List */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h3 className="text-xl font-bold text-light mb-4">Active Vouchers</h3>

        {loading ? (
          <div className="text-center py-8 text-light/60">Loading vouchers...</div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎫</div>
            <p className="text-light/60">No vouchers created yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vouchers.map(voucher => {
              const isExpired = new Date(voucher.expirationDate) < new Date();
              const isMaxed = voucher.usedCount >= voucher.maxUses;
              const isActive = voucher.status === 'active' && !isExpired && !isMaxed;

              return (
                <div
                  key={voucher.id}
                  className={`bg-white/5 border rounded-lg p-4 transition-all ${
                    isActive
                      ? 'border-success/30 hover:border-success/50'
                      : 'border-white/10 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Voucher Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="font-mono text-accent font-bold text-lg">
                          {voucher.code}
                        </code>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          isActive
                            ? 'bg-success/20 text-success'
                            : isExpired
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-white/10 text-light/50'
                        }`}>
                          {isActive ? 'ACTIVE' : isExpired ? 'EXPIRED' : 'MAXED OUT'}
                        </span>
                      </div>

                      <p className="text-light/70 text-sm mb-2">{voucher.description}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-light/50">Plan:</span>
                          <p className="text-light font-medium capitalize">{voucher.plan}</p>
                        </div>
                        <div>
                          <span className="text-light/50">Duration:</span>
                          <p className="text-light font-medium">{voucher.duration} days</p>
                        </div>
                        <div>
                          <span className="text-light/50">Uses:</span>
                          <p className="text-light font-medium">
                            {voucher.usedCount} / {voucher.maxUses}
                          </p>
                        </div>
                        <div>
                          <span className="text-light/50">Expires:</span>
                          <p className={`font-medium ${isExpired ? 'text-red-400' : 'text-light'}`}>
                            {new Date(voucher.expirationDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => copyToClipboard(voucher.code)}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg text-sm transition-all"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={() => handleDelete(voucher.id)}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-all"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats */}
      {vouchers.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-light">
              {vouchers.filter(v => v.status === 'active' && new Date(v.expirationDate) > new Date()).length}
            </div>
            <div className="text-sm text-light/60">Active</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-success">
              {vouchers.reduce((sum, v) => sum + v.usedCount, 0)}
            </div>
            <div className="text-sm text-light/60">Total Uses</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">
              {vouchers.filter(v => new Date(v.expirationDate) < new Date()).length}
            </div>
            <div className="text-sm text-light/60">Expired</div>
          </div>
        </div>
      )}
    </div>
  );
}
