// Admin Cases & Triage Logic
import { requireRole } from "../guard.js";
import { getCases, getLawyers, updateCaseLawyer, updateCaseStatus } from "../firestore.js";
import { formatDate, getStatusBadge, showToast, showModal, closeModal, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["admin"]);
  if (!profile) return;

  const tbody = document.getElementById("cases-tbody");
  const searchInput = document.getElementById("case-search");
  const statusFilter = document.getElementById("status-filter");

  let allCases = [];
  let lawyersList = [];

  try {
    [allCases, lawyersList] = await Promise.all([
      getCases(),
      getLawyers(true)
    ]);
    render();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Error loading cases: ${err.message}</td></tr>`;
  }

  function render() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const st = statusFilter.value;

    const filtered = allCases.filter(c => {
      const matchQ = !q || (c.caseTitle || "").toLowerCase().includes(q) || (c.clientName || "").toLowerCase().includes(q) || (c.id || "").toLowerCase().includes(q);
      const matchSt = !st || c.status === st;
      return matchQ && matchSt;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:40px;">No firm cases found matching criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--navy); font-size:14px;">${escapeHtml(c.caseTitle)}</div>
          <small class="text-muted">#LC-${c.id.slice(0, 6).toUpperCase()}</small>
        </td>
        <td>
          <div style="font-weight:600;">${escapeHtml(c.clientName || "Client")}</div>
          <small class="text-muted">${escapeHtml(c.clientEmail || "")}</small>
        </td>
        <td>${escapeHtml(c.caseType || "General Practice")}</td>
        <td>
          ${c.lawyerName && c.lawyerName !== "Pending Assignment" ? `<b>${escapeHtml(c.lawyerName)}</b>` : '<span class="status-badge status-pending" style="font-size:11px;">Unassigned</span>'}
        </td>
        <td>${getStatusBadge(c.status, c.statusLabel)}</td>
        <td>${formatDate(c.dateCreated)}</td>
        <td>
          <button class="btn btn-outline btn-sm assign-btn" data-id="${c.id}" data-lawyer="${c.lawyerId || ''}" data-title="${escapeHtml(c.caseTitle)}">Reassign / Manage</button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".assign-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        openReassignModal(btn.dataset.id, btn.dataset.lawyer, btn.dataset.title);
      });
    });
  }

  function openReassignModal(caseId, currentLawyerId, title) {
    const options = lawyersList.map(l => {
      const id = l.id || l.userId;
      return `<option value="${id}" ${id === currentLawyerId ? 'selected' : ''}>${escapeHtml(l.displayName)} (${escapeHtml(l.specialization)})</option>`;
    }).join("");

    showModal(
      `Manage Counsel: ${title}`,
      `
        <div class="form-group">
          <label class="form-label">Assign / Transfer Legal Counsel <span class="required">*</span></label>
          <select id="modal-select-lawyer" class="form-control">
            ${options}
          </select>
        </div>
      `,
      `
        <button class="btn btn-outline" id="modal-cancel">Cancel</button>
        <button class="btn btn-gold" id="modal-save">Update Assignment</button>
      `
    );

    document.getElementById("modal-cancel").addEventListener("click", closeModal);
    document.getElementById("modal-save").addEventListener("click", async () => {
      const sel = document.getElementById("modal-select-lawyer");
      const lawyerId = sel.value;
      const lawyerName = sel.options[sel.selectedIndex].text.split(" (")[0];

      try {
        await updateCaseLawyer(caseId, lawyerId, lawyerName, profile);
        closeModal();
        showToast(`Matter assigned to ${lawyerName}.`, "success");
        allCases = await getCases();
        render();
      } catch (err) {
        alert("Error updating assignment: " + err.message);
      }
    });
  }

  searchInput.addEventListener("input", render);
  statusFilter.addEventListener("change", render);
});
