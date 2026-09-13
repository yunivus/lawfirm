// Client Documents Logic
import { requireRole } from "../guard.js";
import { getDocuments, getCases } from "../firestore.js";
import { uploadCaseDocument } from "../storage.js";
import { initNotificationBell } from "../notifications.js";
import { formatDate, showToast, showModal, closeModal, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["client"]);
  if (!profile) return;

  initNotificationBell(profile.id);

  const tbody = document.getElementById("docs-tbody");
  const searchInput = document.getElementById("doc-search");
  const categoryFilter = document.getElementById("category-filter");
  const uploadBtn = document.getElementById("upload-btn");

  let allDocs = [];
  let userCases = [];

  try {
    [allDocs, userCases] = await Promise.all([
      getDocuments({ ownerId: profile.id }),
      getCases({ clientId: profile.id })
    ]);
    renderTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Error loading documents: ${err.message}</td></tr>`;
  }

  function renderTable() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const cat = categoryFilter.value;

    const filtered = allDocs.filter(d => {
      const matchSearch = !q || (d.fileName || "").toLowerCase().includes(q) || (d.caseTitle || "").toLowerCase().includes(q);
      const matchCat = !cat || d.category === cat;
      return matchSearch && matchCat;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted" style="padding:40px 20px;">
            No documents found matching your filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(d => `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--navy); font-size:14px;">📄 ${escapeHtml(d.fileName)}</div>
          <small class="text-muted">${d.contentType || 'application/octet-stream'}</small>
        </td>
        <td><b>${escapeHtml(d.caseTitle || "Case Document")}</b></td>
        <td><span class="status-badge" style="background:#f1f5f9; color:var(--navy);">${escapeHtml(d.category || 'general')}</span></td>
        <td>${((d.sizeBytes || 0) / 1024).toFixed(0)} KB</td>
        <td>${formatDate(d.createdAt)}</td>
        <td>
          <a href="${d.downloadUrl || '#'}" target="_blank" download="${d.fileName}" class="btn btn-outline btn-sm">Download File</a>
        </td>
      </tr>
    `).join("");
  }

  searchInput.addEventListener("input", renderTable);
  categoryFilter.addEventListener("change", renderTable);

  uploadBtn.addEventListener("click", () => {
    if (userCases.length === 0) {
      showToast("You need to have at least one active legal matter before uploading case files.", "error");
      return;
    }

    const caseOptions = userCases.map(c => `<option value="${c.id}">${escapeHtml(c.caseTitle)}</option>`).join("");

    showModal(
      "Upload Document to Case",
      `
        <div class="form-group">
          <label class="form-label">Associated Legal Matter <span class="required">*</span></label>
          <select id="modal-case-id" class="form-control" required>
            ${caseOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Classification</label>
          <select id="modal-cat" class="form-control">
            <option value="supporting_evidence">Supporting Evidence</option>
            <option value="contract">Contracts & Agreements</option>
            <option value="client_id">Identity Verification</option>
            <option value="pleading">Court Pleadings</option>
            <option value="general">General Correspondence</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">File <span class="required">*</span></label>
          <input type="file" id="modal-file" class="form-control" accept=".pdf,.png,.jpg,.jpeg,.docx" required>
          <span class="form-help">Allowed: PDF, PNG, JPG, DOCX (Max 10 MB)</span>
        </div>
        <div id="modal-doc-error" class="form-error" style="display:none;"></div>
      `,
      `
        <button class="btn btn-outline" id="modal-cancel-btn">Cancel</button>
        <button class="btn btn-gold" id="modal-submit-btn">Upload</button>
      `
    );

    document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
    document.getElementById("modal-submit-btn").addEventListener("click", async () => {
      const caseSelect = document.getElementById("modal-case-id");
      const cat = document.getElementById("modal-cat").value;
      const fileInput = document.getElementById("modal-file");
      const errorEl = document.getElementById("modal-doc-error");
      const submitBtn = document.getElementById("modal-submit-btn");

      if (!fileInput.files || !fileInput.files[0]) {
        errorEl.textContent = "Please select a file to upload.";
        errorEl.style.display = "block";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Uploading...';

      try {
        const caseId = caseSelect.value;
        const caseTitle = caseSelect.options[caseSelect.selectedIndex].text;
        await uploadCaseDocument({
          caseId,
          caseTitle,
          file: fileInput.files[0],
          category: cat,
          user: profile
        });

        closeModal();
        showToast("File uploaded successfully.", "success");
        allDocs = await getDocuments({ ownerId: profile.id });
        renderTable();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Upload";
      }
    });
  });
});
