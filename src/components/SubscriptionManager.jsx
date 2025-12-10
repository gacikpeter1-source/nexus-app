// src/components/SubscriptionManager.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getAllInvoices, 
  updateInvoice, 
  updateSubscription,
  getSubscription
} from '../firebase/firestore';

export default function SubscriptionManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, paid, all

  useEffect(() => {
    loadInvoices();
  }, [filter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const allInvoices = await getAllInvoices();
      
      let filtered = allInvoices;
      if (filter === 'pending') {
        filtered = allInvoices.filter(inv => inv.status === 'pending');
      } else if (filter === 'paid') {
        filtered = allInvoices.filter(inv => inv.status === 'paid');
      }

      // Sort by date (newest first)
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setInvoices(filtered);
    } catch (error) {
      console.error('Error loading invoices:', error);
      showToast('Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (invoice) => {
    if (!window.confirm(`Verify payment for invoice ${invoice.invoiceNumber}?`)) {
      return;
    }

    try {
      // Update invoice status
      await updateInvoice(invoice.id, {
        status: 'paid',
        paidAt: new Date().toISOString(),
        verifiedBy: user.id
      });

      // Activate subscription
      const subscription = await getSubscription(invoice.subscriptionId);
      if (subscription) {
        await updateSubscription(invoice.subscriptionId, {
          status: 'active'
        });
      }

      showToast('Payment verified and subscription activated!', 'success');
      loadInvoices();
    } catch (error) {
      console.error('Error verifying payment:', error);
      showToast('Failed to verify payment', 'error');
    }
  };

  const handleRejectPayment = async (invoice) => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;

    try {
      await updateInvoice(invoice.id, {
        status: 'rejected',
        rejectionReason: reason,
        rejectedBy: user.id,
        rejectedAt: new Date().toISOString()
      });

      showToast('Invoice rejected', 'info');
      loadInvoices();
    } catch (error) {
      console.error('Error rejecting invoice:', error);
      showToast('Failed to reject invoice', 'error');
    }
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
          <h2 className="font-title text-3xl text-light">Subscription Manager</h2>
        </div>
        <button
          onClick={loadInvoices}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'pending', 'paid'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-white/10 text-light/70 hover:bg-white/20 hover:text-light'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-light/60">Loading invoices...</div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-2xl font-bold text-light mb-2">No Invoices</h3>
          <p className="text-light/60">No {filter} invoices found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map(invoice => (
            <div
              key={invoice.id}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Invoice Info */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-accent text-lg">
                      {invoice.invoiceNumber}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      invoice.status === 'paid'
                        ? 'bg-success/20 text-success'
                        : invoice.status === 'pending'
                        ? 'bg-warning/20 text-warning'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {invoice.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-light/50">Customer:</span>
                      <p className="text-light font-medium">{invoice.customerName}</p>
                      <p className="text-light/60 text-xs">{invoice.customerEmail}</p>
                    </div>
                    <div>
                      <span className="text-light/50">Plan:</span>
                      <p className="text-light font-medium">{invoice.planName}</p>
                      <p className="text-light/60 text-xs">{invoice.billingCycle}</p>
                    </div>
                    <div>
                      <span className="text-light/50">Amount:</span>
                      <p className="text-accent font-bold text-lg">€{(invoice.total || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-light/50">Due Date:</span>
                      <p className="text-light">{new Date(invoice.dueDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {invoice.status === 'paid' && invoice.paidAt && (
                    <div className="text-xs text-success">
                      ✓ Paid on {new Date(invoice.paidAt).toLocaleString()}
                    </div>
                  )}

                  {invoice.status === 'rejected' && invoice.rejectionReason && (
                    <div className="text-xs text-red-400">
                      ✗ Rejected: {invoice.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {invoice.status === 'pending' && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleVerifyPayment(invoice)}
                      className="px-4 py-2 bg-success hover:bg-success/80 text-white rounded-lg transition-all font-medium text-sm"
                    >
                      ✓ Verify Payment
                    </button>
                    <button
                      onClick={() => handleRejectPayment(invoice)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-all font-medium text-sm"
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-light">{invoices.filter(i => i.status === 'pending').length}</div>
            <div className="text-sm text-light/60">Pending</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-success">{invoices.filter(i => i.status === 'paid').length}</div>
            <div className="text-sm text-light/60">Paid</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-accent">
              €{invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0).toFixed(2)}
            </div>
            <div className="text-sm text-light/60">Total Revenue</div>
          </div>
        </div>
      )}
    </div>
  );
}
