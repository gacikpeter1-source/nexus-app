// src/components/VoucherGenerator.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createVoucher, getAllVouchers, deleteVoucher } from '../firebase/firestore';

export default function VoucherGenerator() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [plan, setPlan] = useState('trial');
  const [duration, setDuration] = useState(30); // days
  const [maxUses, setMaxUses] = useState(1);
  const [description, setDescription] = useState('');
  const [isPermanent, setIsPermanent] = useState(false); // NEW: Permanent voucher toggle

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

  const generateVoucherCode = (plan, expirationDate, duration, isPermanent) => {
    // Format: PLAN-RANDOM-EXPIRY-DURATION
    // Permanent: PLAN-RANDOM-PERM-UNLIM
    
    const planCode = plan.substring(0, 4).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    if (isPermanent) {
      return `${planCode}-${random}-PERM-UNLIM`;
    }
    
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
      let expirationDate;
      if (isPermanent) {
        // Set to 100 years in future for "permanent"
        expirationDate = new Date();
        expirationDate.setFullYear(expirationDate.getFullYear() + 100);
      } else {
        expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + parseInt(duration));
      }

      // Generate unique code
      const code = generateVoucherCode(plan, expirationDate, duration, isPermanent);

      // Create voucher
      const voucherData = {
        code,
        plan,
        duration: isPermanent ? null : parseInt(duration), // null for permanent
        expirationDate: expirationDate.toISOString(),
        maxUses: parseInt(maxUses),
        usedCount: 0,
        usedBy: [],
        status: 'active',
        description: description.trim(),
        isPermanent: isPermanent, // NEW: Flag for permanent vouchers
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
      setIsPermanent(false);
      
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all flex items-center gap-2"
          >
            ← Back
          </button>
          <h2 className="font-title text-3xl text-light">Voucher Generator</h2>
        </div>
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
              disabled={isPermanent}
              className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            
            {/* Permanent Checkbox */}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPermanent}
                onChange={(e) => setIsPermanent(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-dark text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span className="text-sm text-light/80">
                ⭐ Permanent/Unlimited (No expiry)
              </span>
            </label>
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
                {generateVoucherCode(plan, new Date(Date.now() + duration * 24 * 60 * 60 * 1000), duration, isPermanent)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-light/60">Expires:</p>
              <p className="text-light font-medium">
                {isPermanent ? (
                  <span className="text-success font-bold">⭐ NEVER (Permanent)</span>
                ) : (
                  new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toLocaleDateString()
                )}
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
              const isExpired = !voucher.isPermanent && new Date(voucher.expirationDate) < new Date();
              const isMaxed = voucher.usedCount >= voucher.maxUses;
              const isActive = voucher.status === 'active' && !isExpired && !isMaxed;

              return (
                <div
                  key={voucher.id}
                  className={`bg-white/5 border rounded-lg p-4 transition-all ${
                    isActive
                      ? voucher.isPermanent 
                        ? 'border-primary/50 hover:border-primary/70 ring-2 ring-primary/20' 
                        : 'border-success/30 hover:border-success/50'
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
                        {voucher.isPermanent && (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-primary/20 text-primary border border-primary/30">
                            ⭐ PERMANENT
                          </span>
                        )}
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
                          <p className="text-light font-medium">
                            {voucher.isPermanent ? '∞ Unlimited' : `${voucher.duration} days`}
                          </p>
                        </div>
                        <div>
                          <span className="text-light/50">Uses:</span>
                          <p className="text-light font-medium">
                            {voucher.usedCount} / {voucher.maxUses}
                          </p>
                        </div>
                        <div>
                          <span className="text-light/50">Expires:</span>
                          <p className={`font-medium ${
                            voucher.isPermanent 
                              ? 'text-success' 
                              : isExpired 
                              ? 'text-red-400' 
                              : 'text-light'
                          }`}>
                            {voucher.isPermanent 
                              ? '⭐ Never' 
                              : new Date(voucher.expirationDate).toLocaleDateString()
                            }
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
                        title={voucher.isPermanent ? "Delete to revoke access" : "Delete voucher"}
                      >
                        🗑️ {voucher.isPermanent ? 'Revoke' : 'Delete'}
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
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-light">
              {vouchers.filter(v => v.status === 'active' && (v.isPermanent || new Date(v.expirationDate) > new Date())).length}
            </div>
            <div className="text-sm text-light/60">Active</div>
          </div>
          <div className="bg-white/5 border border-primary/20 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {vouchers.filter(v => v.isPermanent).length}
            </div>
            <div className="text-sm text-light/60">⭐ Permanent</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-success">
              {vouchers.reduce((sum, v) => sum + v.usedCount, 0)}
            </div>
            <div className="text-sm text-light/60">Total Uses</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">
              {vouchers.filter(v => !v.isPermanent && new Date(v.expirationDate) < new Date()).length}
            </div>
            <div className="text-sm text-light/60">Expired</div>
          </div>
        </div>
      )}
    </div>
  );
}

