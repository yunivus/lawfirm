// Admin Documents Logic
import { requireRole } from "../guard.js";
import { getDocuments } from "../firestore.js";
import { formatDate, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["admin"]);
  if (!profile) return;

  const tbody = document.getElementById("docs-tbody");
  const searchInput = document.getElementById("doc-search");

  let allDocs = [];

  try {
    allDocs = await getDocuments();
    render();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Error loading files: ${err.message}</td></tr>`;
  }

  function render() {
    const q = (searchInput.value || "").toLowerCase().trim();

    const filtered = allDocs.filter(d => {
      return !q || (d.fileName || "").toLowerCase().includes(q) || (d.caseTitle || "").toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:40px;">No documents found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(d => `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--navy); font-size:14px;">📄 ${escapeHtml(d.fileName)}</div>
          <small class="text-muted">${d.contentType || 'application/octet-stream'}</small>
        </td>
        <td><b>${escapeHtml(d.caseTitle || "General Matter")}</b></td>
        <td><span class="status-badge" style="background:#f1f5f9; color:var(--navy);">${escapeHtml(d.category || 'general')}</span></td>
        <td>${escapeHtml(d.uploadedByName || "Firm Staff")}</td>
        <td>${((d.sizeBytes || 0) / 1024).toFixed(0)} KB</td>
        <td>${formatDate(d.createdAt)}</td>
        <td>
          <a href="${d.downloadUrl || '#'}" target="_blank" download="${d.fileName}" class="btn btn-outline btn-sm">Download</a>
        </td>
      </tr>
    `).join("");
  }

  searchInput.addEventListener("input", render);
});
