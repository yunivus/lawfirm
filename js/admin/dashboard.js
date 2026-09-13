// Admin Dashboard Logic
import { requireRole } from "../guard.js";
import { getCases, getServiceRequests, getUsers, getInvoices, getAuditLogs, getLawyers, updateServiceRequestStatus, updateCaseLawyer, updateCaseStatus } from "../firestore.js";
import { formatDate, formatDateTime, formatCurrency, getStatusBadge, showToast, showModal, closeModal, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["admin"]);
  if (!profile) return;

  const triageTbody = document.getElementById("triage-tbody");
  const recentCasesTbody = document.getElementById("recent-cases-tbody");
  const auditList = document.getElementById("audit-list");

  let lawyersList = [];

  try {
    const [cases, requests, users, invoices, logs, lawyers] = await Promise.all([
      getCases(),
      getServiceRequests("pending"),
      getUsers(),
      getInvoices(),
      getAuditLogs(10),
      getLawyers(true)
    ]);

    lawyersList = lawyers;

    // Metrics
    document.getElementById("admin-kpi-cases").textContent = cases.length;
    document.getElementById("admin-kpi-triage").textContent = requests.length;
    document.getElementById("admin-kpi-users").textContent = users.length;

    const totalRevenue = invoices
      .filter(i => i.status === "paid")
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    document.getElementById("admin-kpi-revenue").textContent = formatCurrency(totalRevenue);

    const badge = document.getElementById("pending-requests-badge");
    if (requests.length > 0) {
      badge.textContent = requests.length;
      badge.style.display = "flex";
    }

    renderTriageTable(requests);
    renderRecentCases(cases);
    renderAuditLogs(logs);

  } catch (err) {
    console.error("Admin dashboard load error:", err);
  }

  function renderTriageTable(requests) {
    if (!requests || requests.length === 0) {
      triageTbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted" style="padding:28px;">
            ✓ All legal service inquiries have been triaged and assigned. No pending requests.
          </td>
        </tr>
      `;
      return;
    }

    triageTbody.innerHTML = requests.map(req => `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--navy);">${escapeHtml(req.clientName || "Client")}</div>
        </td>
        <td><span class="status-badge" style="background:#f1f5f9; color:var(--navy);">${escapeHtml(req.serviceType)}</span></td>
        <td>
          <div style="font-weight:600; font-size:13px;">${escapeHtml(req.subject)}</div>
          <small class="text-muted" style="display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(req.description)}</small>
        </td>
        <td>
          <span style="font-size:11px; font-weight:700; color:${req.priority === 'critical' || req.priority === 'high' ? 'var(--red)' : 'var(--navy)'};">
            ${(req.priority || 'Normal').toUpperCase()}
          </span>
        </td>
        <td>${formatDate(req.createdAt)}</td>
        <td>
          <button class="btn btn-gold btn-sm assign-req-btn" data-id="${req.id}" data-case="${req.caseId || ''}" data-title="${escapeHtml(req.subject)}" data-type="${escapeHtml(req.serviceType)}">
            Assign Counsel →
          </button>
        </td>
      </tr>
    `).join("");

    triageTbody.querySelectorAll(".assign-req-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        openAssignModal(btn.dataset.id, btn.dataset.case, btn.dataset.title, btn.dataset.type);
      });
    });
  }

  function openAssignModal(requestId, caseId, title, serviceType) {
    const options = lawyersList.map(l => `<option value="${l.id || l.userId}">${escapeHtml(l.displayName)} (${escapeHtml(l.specialization)})</option>`).join("");

    showModal(
      "Assign Legal Counsel",
      `
        <div style="background:var(--surface-alt); padding:14px; border-radius:var(--radius); margin-bottom:14px; border:1px solid var(--line);">
          <div class="text-xs text-muted">Service Request:</div>
          <div style="font-weight:600; color:var(--navy);">${title}</div>
          <div class="text-xs text-muted mt-1">Area: ${serviceType}</div>
        </div>

        <div class="form-group">
          <label class="form-label">Select Firm Attorney <span class="required">*</span></label>
          <select id="modal-lawyer-select" class="form-control" required>
            ${options}
          </select>
          <span class="form-help">Attorney will receive full case file and client communications access.</span>
        </div>
      `,
      `
        <button class="btn btn-outline" id="modal-assign-cancel">Cancel</button>
        <button class="btn btn-gold" id="modal-assign-confirm">Assign & Notify Counsel</button>
      `
    );

    document.getElementById("modal-assign-cancel").addEventListener("click", closeModal);
    document.getElementById("modal-assign-confirm").addEventListener("click", async () => {
      const select = document.getElementById("modal-lawyer-select");
      const lawyerId = select.value;
      const lawyerName = select.options[select.selectedIndex].text.split(" (")[0];

      const confirmBtn = document.getElementById("modal-assign-confirm");
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner"></span> Assigning...';

      try {
        if (caseId) {
          await updateCaseLawyer(caseId, lawyerId, lawyerName, profile);
          await updateCaseStatus(caseId, "lawyer_assigned", "Lawyer Assigned", `Firm administration matched and assigned counsel: ${lawyerName}.`, profile);
        }
        await updateServiceRequestStatus(requestId, "approved", lawyerId, lawyerName, profile);

        closeModal();
        showToast(`Matter assigned to ${lawyerName}. Client and attorney notified.`, "success");
        setTimeout(() => window.location.reload(), 800);
      } catch (err) {
        showToast("Assignment error: " + err.message, "error");
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = "Assign & Notify Counsel";
      }
    });
  }

  function renderRecentCases(cases) {
    if (!cases || cases.length === 0) {
      recentCasesTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No cases filed yet.</td></tr>`;
      return;
    }

    recentCasesTbody.innerHTML = cases.slice(0, 6).map(c => `
      <tr>
        <td>
          <a href="cases.html" style="font-weight:600; color:var(--navy); font-size:13px;">${escapeHtml(c.caseTitle)}</a>
          <div class="text-xs text-muted">#LC-${c.id.slice(0, 5).toUpperCase()}</div>
        </td>
        <td>${escapeHtml(c.clientName || "Client")}</td>
        <td><b>${escapeHtml(c.lawyerName || "Unassigned")}</b></td>
        <td>${getStatusBadge(c.status, c.statusLabel)}</td>
      </tr>
    `).join("");
  }

  function renderAuditLogs(logs) {
    if (!logs || logs.length === 0) {
      auditList.innerHTML = `<div class="text-center text-muted text-sm py-4">No audit events recorded yet.</div>`;
      return;
    }

    auditList.innerHTML = logs.map(l => `
      <div style="padding:10px 12px; border:1px solid var(--line); border-radius:var(--radius); font-size:13px; background:#fff;">
        <div class="flex justify-between items-center">
          <span style="font-weight:600; color:var(--navy);">${escapeHtml(l.action)}</span>
          <span class="text-xs text-muted">${formatDateTime(l.timestamp)}</span>
        </div>
        <div class="text-xs text-muted mt-1">Initiator: <b>${escapeHtml(l.userName || l.userId)}</b> · Target: ${escapeHtml(l.targetType)} (${escapeHtml(l.targetId || '')})</div>
      </div>
    `).join("");
  }
});
