// Admin Invoices Logic
import { requireRole } from "../guard.js";
import { getInvoices, createInvoice, getUsers, getCases } from "../firestore.js";
import { formatDate, formatCurrency, getStatusBadge, showToast, showModal, closeModal, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["admin"]);
  if (!profile) return;

  const tbody = document.getElementById("invoices-tbody");
  const createBtn = document.getElementById("create-invoice-btn");

  let allUsers = [];
  let allCases = [];

  try {
    [allUsers, allCases] = await Promise.all([
      getUsers("client"),
      getCases()
    ]);
    await load();
  } catch (err) {
    console.error("Init err:", err);
  }

  async function load() {
    try {
      const list = await getInvoices();
      if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:40px;">No firm invoices issued yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(inv => `
        <tr>
          <td>
            <div style="font-weight:600; color:var(--navy); font-size:14px;">#INV-${inv.id.slice(0, 6).toUpperCase()}</div>
            <small class="text-muted">Issued ${formatDate(inv.createdAt)}</small>
          </td>
          <td><b>${escapeHtml(inv.clientName || "Client")}</b></td>
          <td>${escapeHtml(inv.caseTitle || "Legal Services")}</td>
          <td>${formatDate(inv.dueDate)}</td>
          <td><b style="font-size:15px; color:var(--navy);">${formatCurrency(inv.amount)}</b></td>
          <td>${getStatusBadge(inv.status)}</td>
          <td>
            <span class="text-xs text-muted">${inv.status === 'paid' ? `Settled on ${formatDate(inv.paidAt)}` : 'Awaiting payment'}</span>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Error loading invoices: ${err.message}</td></tr>`;
    }
  }

  createBtn.addEventListener("click", () => {
    const clientOptions = allUsers.map(u => `<option value="${u.id}">${escapeHtml(u.displayName || u.email)} (${escapeHtml(u.email)})</option>`).join("");
    const caseOptions = allCases.map(c => `<option value="${c.id}" data-client="${c.clientId}" data-client-name="${escapeHtml(c.clientName || '')}">${escapeHtml(c.caseTitle)}</option>`).join("");

    showModal(
      "Issue Client Invoice",
      `
        <div class="form-group">
          <label class="form-label">Client <span class="required">*</span></label>
          <select id="modal-inv-client" class="form-control" required>
            ${clientOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Associated Legal Matter</label>
          <select id="modal-inv-case" class="form-control">
            <option value="">-- General Firm Retainer --</option>
            ${caseOptions}
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fee Amount (USD) <span class="required">*</span></label>
            <input type="number" id="modal-inv-amount" class="form-control" placeholder="1500.00" min="1" step="0.01" required>
          </div>
          <div class="form-group">
            <label class="form-label">Due Date <span class="required">*</span></label>
            <input type="date" id="modal-inv-due" class="form-control" value="${new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]}" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Description / Legal Billing Items <span class="required">*</span></label>
          <textarea id="modal-inv-desc" class="form-control" placeholder="e.g. Legal research, draft preparation, court filing fee reimbursement..." required></textarea>
        </div>
        <div id="modal-inv-error" class="form-error" style="display:none;"></div>
      `,
      `
        <button class="btn btn-outline" id="modal-inv-cancel">Cancel</button>
        <button class="btn btn-gold" id="modal-inv-submit">Issue & Send Invoice</button>
      `
    );

    document.getElementById("modal-inv-cancel").addEventListener("click", closeModal);
    document.getElementById("modal-inv-submit").addEventListener("click", async () => {
      const clientSelect = document.getElementById("modal-inv-client");
      const caseSelect = document.getElementById("modal-inv-case");
      const amount = document.getElementById("modal-inv-amount").value;
      const dueDate = document.getElementById("modal-inv-due").value;
      const desc = document.getElementById("modal-inv-desc").value;
      const errorEl = document.getElementById("modal-inv-error");
      const submitBtn = document.getElementById("modal-inv-submit");

      const clientId = clientSelect.value;
      const clientName = clientSelect.options[clientSelect.selectedIndex].text.split(" (")[0];
      const caseId = caseSelect.value || null;
      const caseTitle = caseId ? caseSelect.options[caseSelect.selectedIndex].text : "General Legal Retainer";

      if (!amount || !dueDate || !desc) {
        errorEl.textContent = "Please provide all invoice parameters.";
        errorEl.style.display = "block";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Issuing...';

      try {
        await createInvoice({
          clientId,
          clientName,
          caseId,
          caseTitle,
          amount: parseFloat(amount),
          dueDate,
          description: desc.trim(),
          adminUser: profile
        });

        closeModal();
        showToast("Invoice issued and dispatched to client portal.", "success");
        await load();
      } catch (err) {
        errorEl.textContent = err.message || "Failed to create invoice.";
        errorEl.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Issue & Send Invoice";
      }
    });
  });

  load();
});
