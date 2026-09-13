// Lawyer Cases List Logic
import { requireRole } from "../guard.js";
import { getCases } from "../firestore.js";
import { formatDate, getStatusBadge, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["lawyer"]);
  if (!profile) return;

  const tbody = document.getElementById("cases-tbody");
  const searchInput = document.getElementById("case-search");
  const stageFilter = document.getElementById("stage-filter");

  let allCases = [];

  try {
    allCases = await getCases({ lawyerId: profile.id });
    render();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Error loading cases: ${err.message}</td></tr>`;
  }

  function render() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const st = stageFilter.value;

    const filtered = allCases.filter(c => {
      const matchQ = !q || (c.caseTitle || "").toLowerCase().includes(q) || (c.clientName || "").toLowerCase().includes(q) || (c.id || "").toLowerCase().includes(q);
      const matchSt = !st || c.status === st;
      return matchQ && matchSt;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted" style="padding:40px;">
            No legal matters found matching the current search parameters.
          </td>
        </tr>
      `;
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
        <td>${getStatusBadge(c.status, c.statusLabel)}</td>
        <td>
          <span style="font-size:12px; font-weight:700; color:${c.priority === 'critical' || c.priority === 'high' ? 'var(--red)' : 'var(--navy)'};">
            ${(c.priority || 'Normal').toUpperCase()}
          </span>
        </td>
        <td>${formatDate(c.dateCreated)}</td>
        <td>
          <a href="case.html?id=${c.id}" class="btn btn-primary btn-sm">Manage Matter →</a>
        </td>
      </tr>
    `).join("");
  }

  searchInput.addEventListener("input", render);
  stageFilter.addEventListener("change", render);
});
