// Client Cases List Logic
import { requireRole } from "../guard.js";
import { getCases } from "../firestore.js";
import { initNotificationBell } from "../notifications.js";
import { formatDate, getStatusBadge, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["client"]);
  if (!profile) return;

  initNotificationBell(profile.id);

  const tbody = document.getElementById("cases-tbody");
  const searchInput = document.getElementById("cases-search");
  const statusFilter = document.getElementById("status-filter");

  let allCases = [];

  try {
    allCases = await getCases({ clientId: profile.id });
    renderTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Error loading cases: ${err.message}</td></tr>`;
  }

  function renderTable() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const st = statusFilter.value;

    const filtered = allCases.filter(c => {
      const matchSearch = !q || (c.caseTitle || "").toLowerCase().includes(q) || (c.id || "").toLowerCase().includes(q);
      const matchStatus = !st || c.status === st;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted" style="padding:40px 20px;">
            No legal matters found matching your search.
            <div class="mt-2">
              <a href="services.html" class="btn btn-gold btn-sm">Request Legal Service →</a>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(c => `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--navy); font-size:14px;">${escapeHtml(c.caseTitle)}</div>
          <small class="text-muted">#LC-${c.id.slice(0, 6).toUpperCase()} ${c.priority === 'high' || c.priority === 'critical' ? '· <span style="color:var(--red); font-weight:700;">' + c.priority.toUpperCase() + '</span>' : ''}</small>
        </td>
        <td>${escapeHtml(c.caseType || "General Practice")}</td>
        <td>
          ${c.lawyerName && c.lawyerName !== "Pending Assignment" ? `<b>${escapeHtml(c.lawyerName)}</b>` : '<span class="text-muted">Pending Admin Review</span>'}
        </td>
        <td>${getStatusBadge(c.status, c.statusLabel)}</td>
        <td>${formatDate(c.dateCreated)}</td>
        <td>
          <a href="case.html?id=${c.id}" class="btn btn-outline btn-sm">Open Workspace →</a>
        </td>
      </tr>
    `).join("");
  }

  searchInput.addEventListener("input", renderTable);
  statusFilter.addEventListener("change", renderTable);
});
