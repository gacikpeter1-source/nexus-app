// src/components/InvoiceGenerator.jsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createInvoice, sendInvoiceEmail } from '../firebase/firestore';
import { SUBSCRIPTION_PLANS, PLAN_PRICING, PLAN_FEATURES } from '../contexts/SubscriptionContext';

export default function InvoiceGenerator({ subscription, onInvoiceCreated }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [invoice, setInvoice] = useState(null);

  const generateInvoice = async () => {
    try {
      setGenerating(true);

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Calculate amounts
      const pricing = PLAN_PRICING[subscription.plan];
      const subtotal = subscription.billingCycle === 'yearly' ? pricing.yearly : pricing.monthly;
      const tax = subtotal * 0.20; // 20% VAT
      const total = subtotal + tax;

      // Create invoice data
      const invoiceData = {
        invoiceNumber,
        subscriptionId: subscription.id,
        userId: user.id,
        clubId: subscription.clubId || null,
        
        // Customer info
        customerName: user.username || user.email,
        customerEmail: user.email,
        
        // Invoice details
        plan: subscription.plan,
        planName: PLAN_FEATURES[subscription.plan].name,
        billingCycle: subscription.billingCycle,
        
        // Amounts
        subtotal,
        tax,
        total,
        currency: 'EUR',
        
        // Status
        status: 'pending',
        
        // Dates
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        
        // Payment info
        paymentMethod: null,
        paidAt: null,
        
        createdAt: new Date().toISOString()
      };

      // Save to Firestore
      const savedInvoice = await createInvoice(invoiceData);
      setInvoice(savedInvoice);

      // Send email (if email function is available)
      try {
        await sendInvoiceEmail(savedInvoice);
        showToast('Invoice sent to your email!', 'success');
      } catch (emailError) {
        console.error('Email send failed:', emailError);
        showToast('Invoice created but email failed to send', 'warning');
      }

      if (onInvoiceCreated) {
        onInvoiceCreated(savedInvoice);
      }

    } catch (error) {
      console.error('Error generating invoice:', error);
      showToast('Failed to generate invoice', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const downloadInvoice = () => {
    if (!invoice) return;

    // Generate HTML invoice
    const html = generateInvoiceHTML(invoice, user);
    
    // Create blob and download
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoiceNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Invoice downloaded', 'success');
  };

  if (invoice) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 space-y-6 animate-fade-in">
        {/* Success Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📄</span>
          </div>
          <h3 className="text-2xl font-bold text-light mb-2">Invoice Generated</h3>
          <p className="text-light/70">Invoice has been sent to your email</p>
        </div>

        {/* Invoice Details */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-3">
          <div className="flex justify-between">
            <span className="text-light/60">Invoice Number:</span>
            <span className="font-mono font-bold text-accent">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-light/60">Plan:</span>
            <span className="font-semibold text-light">{invoice.planName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-light/60">Billing:</span>
            <span className="text-light">{invoice.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}</span>
          </div>
          <div className="h-px bg-white/10 my-4"></div>
          <div className="flex justify-between">
            <span className="text-light/60">Subtotal:</span>
            <span className="text-light">€{invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-light/60">VAT (20%):</span>
            <span className="text-light">€{invoice.tax.toFixed(2)}</span>
          </div>
          <div className="h-px bg-white/10 my-4"></div>
          <div className="flex justify-between text-lg font-bold">
            <span className="text-light">Total:</span>
            <span className="text-accent">€{invoice.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-light/60">Due Date:</span>
            <span className="text-warning">{new Date(invoice.dueDate).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Payment Instructions */}
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <h4 className="font-semibold text-warning mb-2">Payment Instructions</h4>
          <ol className="text-sm text-light/80 space-y-2 list-decimal list-inside">
            <li>Check your email for the complete invoice</li>
            <li>Make payment within 7 days to activate subscription</li>
            <li>Admin will verify payment and activate your subscription</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={downloadInvoice}
            className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all font-medium"
          >
            📥 Download Invoice
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg transition-all font-medium"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center">
      <h3 className="text-2xl font-bold text-light mb-4">Generate Invoice</h3>
      <p className="text-light/70 mb-6">
        Click below to generate and send your invoice via email
      </p>
      <button
        onClick={generateInvoice}
        disabled={generating}
        className="px-8 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
      >
        {generating ? 'Generating...' : '📄 Generate Invoice'}
      </button>
    </div>
  );
}

// Helper function to generate HTML invoice
function generateInvoiceHTML(invoice, user) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .invoice {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 20px;
    }
    .logo { font-size: 32px; font-weight: bold; color: #3b82f6; }
    .invoice-details { text-align: right; }
    .details { margin-bottom: 30px; }
    .table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    .table th { background: #f8f9fa; font-weight: bold; }
    .totals { text-align: right; margin-top: 20px; }
    .total-row { display: flex; justify-content: flex-end; margin: 8px 0; }
    .total-label { width: 150px; text-align: right; padding-right: 20px; }
    .total-amount { width: 120px; text-align: right; font-weight: bold; }
    .grand-total { font-size: 20px; color: #3b82f6; padding-top: 10px; border-top: 2px solid #ddd; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div>
        <div class="logo">NEXUS</div>
        <p>Sports Management Platform</p>
      </div>
      <div class="invoice-details">
        <h2>INVOICE</h2>
        <p><strong>${invoice.invoiceNumber}</strong></p>
        <p>Date: ${new Date(invoice.issueDate).toLocaleDateString()}</p>
        <p>Due: ${new Date(invoice.dueDate).toLocaleDateString()}</p>
      </div>
    </div>

    <div class="details">
      <h3>Bill To:</h3>
      <p><strong>${invoice.customerName}</strong></p>
      <p>${invoice.customerEmail}</p>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${invoice.planName}</strong><br>
            <small>${invoice.billingCycle === 'yearly' ? 'Annual' : 'Monthly'} Subscription</small>
          </td>
          <td style="text-align: right">€${invoice.subtotal.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <div class="total-label">Subtotal:</div>
        <div class="total-amount">€${invoice.subtotal.toFixed(2)}</div>
      </div>
      <div class="total-row">
        <div class="total-label">VAT (20%):</div>
        <div class="total-amount">€${invoice.tax.toFixed(2)}</div>
      </div>
      <div class="total-row grand-total">
        <div class="total-label">Total Due:</div>
        <div class="total-amount">€${invoice.total.toFixed(2)}</div>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>Questions? Contact support@nexus.com</p>
    </div>
  </div>
</body>
</html>
  `;
}
