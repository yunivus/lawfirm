// Client Invoices Logic
import { requireRole } from "../guard.js";
import { getInvoices, payInvoice } from "../firestore.js";
import { initNotificationBell } from "../notifications.js";
import { formatDate, formatCurrency, getStatusBadge, showToast, showModal, closeModal, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["client"]);
  if (!profile) return;

  initNotificationBell(profile.id);

  const tbody = document.getElementById("invoices-tbody");

  async function loadInvoices() {
    try {
      const list = await getInvoices({ clientId: profile.id });
      if (!list || list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-muted" style="padding:40px 20px;">
              You have no invoices on record.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = list.map(inv => `
        <tr>
          <td>
            <div style="font-weight:600; color:var(--navy); font-size:14px;">#INV-${inv.id.slice(0, 6).toUpperCase()}</div>
            <small class="text-muted">Issued ${formatDate(inv.createdAt)}</small>
          </td>
          <td><b>${escapeHtml(inv.caseTitle || "Legal Retainer")}</b></td>
          <td>${formatDate(inv.dueDate)}</td>
          <td><b style="font-size:15px; color:var(--navy);">${formatCurrency(inv.amount)}</b></td>
          <td>${getStatusBadge(inv.status)}</td>
          <td>
            ${inv.status !== 'paid' ? `
              <button class="btn btn-gold btn-sm pay-btn" data-id="${inv.id}" data-amount="${inv.amount}" data-title="${escapeHtml(inv.caseTitle || 'Legal Services')}">Pay Online</button>
            ` : `
              <button class="btn btn-outline btn-sm receipt-btn" data-id="${inv.id}" data-amount="${inv.amount}" data-title="${escapeHtml(inv.caseTitle || 'Legal Services')}" data-paid="${formatDate(inv.paidAt)}">Receipt</button>
            `}
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll(".pay-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openPaymentModal(btn.dataset.id, btn.dataset.amount, btn.dataset.title);
        });
      });

      tbody.querySelectorAll(".receipt-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openReceiptModal(btn.dataset.id, btn.dataset.amount, btn.dataset.title, btn.dataset.paid);
        });
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Error loading invoices: ${err.message}</td></tr>`;
    }
  }

  function openPaymentModal(invoiceId, amount, caseTitle) {
    showModal(
      `Pay Invoice #INV-${invoiceId.slice(0, 6).toUpperCase()}`,
      `
        <div style="background:var(--surface-alt); padding:16px; border-radius:var(--radius); margin-bottom:16px; border:1px solid var(--line);">
          <div class="flex justify-between items-center">
            <span class="text-sm text-muted">Statement:</span>
            <span style="font-weight:600; color:var(--navy);">${caseTitle}</span>
          </div>
          <div class="flex justify-between items-center mt-2">
            <span class="text-sm text-muted">Total Due:</span>
            <span style="font-size:20px; font-weight:700; color:var(--navy);">${formatCurrency(amount)}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Payment Method</label>
          <select id="pay-method" class="form-control">
            <option value="card">Credit / Debit Card (Visa, Mastercard, Amex)</option>
            <option value="ach">Bank Wire / ACH Transfer</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Card Number</label>
          <input type="text" class="form-control" placeholder="•••• •••• •••• 4242" value="4111 2222 3333 4242">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Expiry</label>
            <input type="text" class="form-control" placeholder="MM/YY" value="12/28">
          </div>
          <div class="form-group">
            <label class="form-label">CVC</label>
            <input type="text" class="form-control" placeholder="CVC" value="888">
          </div>
        </div>
      `,
      `
        <button class="btn btn-outline" id="modal-pay-cancel">Cancel</button>
        <button class="btn btn-gold" id="modal-pay-submit">Authorize & Pay ${formatCurrency(amount)}</button>
      `
    );

    document.getElementById("modal-pay-cancel").addEventListener("click", closeModal);
    document.getElementById("modal-pay-submit").addEventListener("click", async () => {
      const submitBtn = document.getElementById("modal-pay-submit");
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Processing Transaction...';

      try {
        await payInvoice(invoiceId, profile);
        closeModal();
        showToast("Payment processed successfully! Your receipt is available.", "success");
        await loadInvoices();
      } catch (err) {
        alert("Payment error: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Authorize & Pay ${formatCurrency(amount)}`;
      }
    });
  }

  function openReceiptModal(invoiceId, amount, caseTitle, paidDate) {
    showModal(
      `Official Payment Receipt`,
      `
        <div style="text-align:center; padding:16px 0; border-bottom:1px solid var(--line);">
          <div style="font-size:32px;">✓</div>
          <h3 style="color:var(--navy); margin-top:8px;">Payment Confirmed</h3>
          <div class="text-sm text-muted">Paid on ${paidDate}</div>
        </div>
        <div style="padding:16px 0; display:flex; flex-direction:column; gap:10px;">
          <div class="flex justify-between">
            <span class="text-muted text-sm">Receipt Ref:</span>
            <b>#REC-${invoiceId.slice(0, 8).toUpperCase()}</b>
          </div>
          <div class="flex justify-between">
            <span class="text-muted text-sm">Case Reference:</span>
            <b>${caseTitle}</b>
          </div>
          <div class="flex justify-between">
            <span class="text-muted text-sm">Client Name:</span>
            <span>${profile.displayName || profile.email}</span>
          </div>
          <div class="flex justify-between" style="border-top:1px solid var(--line); padding-top:10px;">
            <span class="text-muted text-sm">Amount Paid:</span>
            <b style="font-size:18px; color:var(--navy);">${formatCurrency(amount)}</b>
          </div>
        </div>
      `,
      `
        <button class="btn btn-outline" id="receipt-close-btn" style="width:100%;">Close Receipt</button>
      `
    );
    document.getElementById("receipt-close-btn").addEventListener("click", closeModal);
  }

  loadInvoices();
});
