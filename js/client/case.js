// Client Case Detail & Progress Tracker Logic
import { requireRole } from "../guard.js";
import { getCaseById, getCaseStatusHistory, getDocuments, getUserProfile } from "../firestore.js";
import { uploadCaseDocument } from "../storage.js";
import { initNotificationBell } from "../notifications.js";
import { formatDate, formatDateTime, getStatusBadge, showToast, showModal, closeModal, escapeHtml } from "../ui.js";

const STAGES = [
  { id: "request_submitted", label: "Request Submitted" },
  { id: "lawyer_assigned", label: "Lawyer Assigned" },
  { id: "documents_under_review", label: "Documents Under Review" },
  { id: "case_preparation", label: "Case Preparation" },
  { id: "proceedings", label: "Court / Proceedings" },
  { id: "completed", label: "Case Completed" }
];

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["client"]);
  if (!profile) return;

  initNotificationBell(profile.id);

  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("id");

  if (!caseId) {
    alert("No case identifier specified.");
    window.location.href = "cases.html";
    return;
  }

  let currentCase = null;

  try {
    currentCase = await getCaseById(caseId);
    if (!currentCase) {
      alert("Case record not found.");
      window.location.href = "cases.html";
      return;
    }

    // Security check: Client can only view their own cases
    if (currentCase.clientId !== profile.id) {
      alert("Unauthorized: You do not have permission to view this legal matter.");
      window.location.href = "cases.html";
      return;
    }

    renderCaseDetails(currentCase);
    await loadHistory(caseId);
    await loadDocuments(caseId, currentCase.caseTitle);
    await loadCounsel(currentCase.lawyerId, currentCase.lawyerName);

    // Wire message shortcut
    const msgBtn = document.getElementById("msg-counsel-btn");
    if (msgBtn) {
      msgBtn.href = `messages.html?caseId=${caseId}`;
    }

    // Wire consultation shortcut
    const consultBtn = document.getElementById("book-consult-btn");
    if (consultBtn) {
      consultBtn.href = `appointments.html?caseId=${caseId}&lawyerId=${currentCase.lawyerId || ''}`;
    }

    // Wire document upload button
    document.getElementById("upload-doc-btn").addEventListener("click", () => {
      openUploadModal(caseId, currentCase.caseTitle, profile);
    });

  } catch (err) {
    console.error("Case loading error:", err);
  }
});

function renderCaseDetails(c) {
  document.getElementById("case-ref").textContent = `Matter #LC-${c.id.slice(0, 6).toUpperCase()}`;
  document.getElementById("case-title").textContent = c.caseTitle;
  document.getElementById("case-meta").textContent = `Filed on ${formatDate(c.dateCreated)} · Last updated ${formatDate(c.updatedAt || c.dateCreated)}`;
  document.getElementById("current-badge").innerHTML = getStatusBadge(c.status, c.statusLabel);

  document.getElementById("case-type").textContent = c.caseType || "General Practice";
  document.getElementById("case-priority").textContent = (c.priority || "Normal").toUpperCase();
  document.getElementById("case-filed").textContent = formatDate(c.dateCreated);
  document.getElementById("case-description").textContent = c.description || "No statement provided.";

  // Render 6-stage tracker
  const currentIdx = STAGES.findIndex(s => s.id === c.status);
  const activeIndex = currentIdx >= 0 ? currentIdx : 0;

  document.getElementById("timeline-container").innerHTML = `
    <div class="timeline">
      ${STAGES.map((stage, idx) => {
        let stateClass = "";
        if (idx < activeIndex) stateClass = "completed";
        else if (idx === activeIndex) stateClass = "current";

        return `
          <div class="timeline-step ${stateClass}">
            <div class="timeline-node">${idx < activeIndex ? "✓" : idx + 1}</div>
            <div class="timeline-label">${escapeHtml(stage.label)}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

async function loadHistory(caseId) {
  const container = document.getElementById("history-container");
  const history = await getCaseStatusHistory(caseId);

  if (!history || history.length === 0) {
    container.innerHTML = `<div class="text-muted text-sm">No historical transitions recorded yet.</div>`;
    return;
  }

  container.innerHTML = history.map(h => `
    <div style="padding:12px; border:1px solid var(--line); border-radius:var(--radius); background:#fff;">
      <div class="flex justify-between items-center mb-1">
        <span style="font-weight:600; color:var(--navy); font-size:13px;">${escapeHtml(h.statusLabel || h.status)}</span>
        <span class="text-xs text-muted">${formatDateTime(h.changedAt)}</span>
      </div>
      <p class="text-sm text-muted" style="margin:0;">${escapeHtml(h.note || "Status advanced.")}</p>
      <div class="text-xs text-muted mt-1" style="font-style:italic;">Updated by: ${escapeHtml(h.changedByName || "Firm Administrator")}</div>
    </div>
  `).join("");
}

async function loadDocuments(caseId, caseTitle) {
  const container = document.getElementById("docs-list");
  const docs = await getDocuments({ caseId });

  if (!docs || docs.length === 0) {
    container.innerHTML = `<div class="text-muted text-sm">No documents attached yet. Click <b>＋ Upload</b> to file evidence or contracts.</div>`;
    return;
  }

  container.innerHTML = docs.map(d => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border:1px solid var(--line); border-radius:var(--radius); background:#fff;">
      <div>
        <div style="font-weight:600; font-size:13px; color:var(--navy);">📄 ${escapeHtml(d.fileName)}</div>
        <div class="text-xs text-muted">${d.category || 'Exhibit'} · ${(d.sizeBytes / 1024).toFixed(0)} KB · ${formatDate(d.createdAt)}</div>
      </div>
      <a href="${d.downloadUrl || '#'}" target="_blank" download="${d.fileName}" class="btn btn-outline btn-sm">Download</a>
    </div>
  `).join("");
}

async function loadCounsel(lawyerId, lawyerName) {
  const container = document.getElementById("counsel-container");
  if (!lawyerId) {
    container.innerHTML = `
      <div class="text-muted text-sm">
        <p>A senior partner is currently reviewing your matter to assign the most appropriate attorney.</p>
        <span class="status-badge status-pending mt-2">Awaiting Assignment</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; gap:14px; align-items:center;">
      <div class="big-avatar" style="width:48px; height:48px; border-radius:50%; background:var(--navy); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700;">
        ⚖
      </div>
      <div>
        <div style="font-weight:600; color:var(--navy); font-size:15px;">${escapeHtml(lawyerName || "Assigned Counsel")}</div>
        <div class="text-sm text-muted">Lead Legal Counsel</div>
        <div class="text-xs mt-1" style="color:var(--gold); font-weight:600;">Licensed Attorney · In Good Standing</div>
      </div>
    </div>
  `;
}

function openUploadModal(caseId, caseTitle, profile) {
  showModal(
    "Upload Case Document",
    `
      <div class="form-group">
        <label class="form-label">Select File <span class="required">*</span></label>
        <input type="file" id="modal-file" class="form-control" accept=".pdf,.png,.jpg,.jpeg,.docx" required>
        <span class="form-help">Allowed: PDF, PNG, JPG, DOCX (Max 10 MB)</span>
      </div>
      <div class="form-group">
        <label class="form-label">Document Classification</label>
        <select id="modal-category" class="form-control">
          <option value="supporting_evidence">Supporting Evidence</option>
          <option value="client_id">Client Identification</option>
          <option value="contract">Contract / Legal Instrument</option>
          <option value="pleading">Court Pleading / Filing</option>
          <option value="general">General Correspondence</option>
        </select>
      </div>
      <div id="modal-upload-error" class="form-error" style="display:none;"></div>
    `,
    `
      <button class="btn btn-outline" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-submit-btn">Upload Document</button>
    `
  );

  document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("modal-submit-btn").addEventListener("click", async () => {
    const fileInput = document.getElementById("modal-file");
    const category = document.getElementById("modal-category").value;
    const errorEl = document.getElementById("modal-upload-error");
    const submitBtn = document.getElementById("modal-submit-btn");

    if (!fileInput.files || !fileInput.files[0]) {
      errorEl.textContent = "Please select a file to upload.";
      errorEl.style.display = "block";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Uploading...';

    try {
      await uploadCaseDocument({
        caseId,
        caseTitle,
        file: fileInput.files[0],
        category,
        user: profile
      });
      closeModal();
      showToast("Document uploaded and logged successfully.", "success");
      await loadDocuments(caseId, caseTitle);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Upload Document";
    }
  });
}
