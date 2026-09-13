// Lawyer Case Workspace Logic
import { requireRole } from "../guard.js";
import { getCaseById, getCaseStatusHistory, updateCaseStatus, getDocuments } from "../firestore.js";
import { uploadCaseDocument } from "../storage.js";
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
  const profile = await requireRole(["lawyer", "admin"]);
  if (!profile) return;

  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("id");

  if (!caseId) {
    showToast("No case ID specified.", "error");
    window.location.href = "cases.html";
    return;
  }

  let currentCase = null;

  async function loadAll() {
    currentCase = await getCaseById(caseId);
    if (!currentCase) {
      showToast("Case not found.", "error");
      window.location.href = "cases.html";
      return;
    }

    renderCaseDetails(currentCase);
    await loadHistory(caseId);
    await loadDocuments(caseId);

    const msgLink = document.getElementById("case-msg-link");
    if (msgLink) msgLink.href = `messages.html?caseId=${caseId}`;
  }

  function renderCaseDetails(c) {
    document.getElementById("case-ref").textContent = `Matter #LC-${c.id.slice(0, 6).toUpperCase()}`;
    document.getElementById("case-title").textContent = c.caseTitle;
    document.getElementById("case-meta").textContent = `Filed on ${formatDate(c.dateCreated)} · Last activity: ${formatDate(c.updatedAt || c.dateCreated)}`;
    document.getElementById("case-badge").innerHTML = getStatusBadge(c.status, c.statusLabel);

    document.getElementById("client-name").textContent = c.clientName || "Client";
    document.getElementById("client-email").textContent = c.clientEmail || "";
    document.getElementById("case-type").textContent = c.caseType || "General Practice";
    document.getElementById("case-priority").textContent = (c.priority || "Normal").toUpperCase();
    document.getElementById("case-description").textContent = c.description || "No statement provided.";

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
        <p class="text-sm text-muted" style="margin:0;">${escapeHtml(h.note || "Procedural step recorded.")}</p>
        <div class="text-xs text-muted mt-1" style="font-style:italic;">Logged by: ${escapeHtml(h.changedByName || "Counsel")}</div>
      </div>
    `).join("");
  }

  async function loadDocuments(caseId) {
    const container = document.getElementById("docs-list");
    const docs = await getDocuments({ caseId });

    if (!docs || docs.length === 0) {
      container.innerHTML = `<div class="text-muted text-sm">No pleadings or exhibits filed yet.</div>`;
      return;
    }

    container.innerHTML = docs.map(d => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border:1px solid var(--line); border-radius:var(--radius); background:#fff;">
        <div>
          <div style="font-weight:600; font-size:13px; color:var(--navy);">📄 ${escapeHtml(d.fileName)}</div>
          <div class="text-xs text-muted">${escapeHtml(d.category || 'general')} · Filed by ${escapeHtml(d.uploadedByName || 'User')} · ${formatDate(d.createdAt)}</div>
        </div>
        <a href="${d.downloadUrl || '#'}" target="_blank" download="${d.fileName}" class="btn btn-outline btn-sm">Download</a>
      </div>
    `).join("");
  }

  // Update Stage Modal
  document.getElementById("update-stage-btn").addEventListener("click", () => {
    const options = STAGES.map(s => `<option value="${s.id}" ${s.id === currentCase.status ? 'selected' : ''}>${s.label}</option>`).join("");

    showModal(
      "Advance Case Milestone",
      `
        <div class="form-group">
          <label class="form-label">New Milestone Stage <span class="required">*</span></label>
          <select id="modal-stage-select" class="form-control">
            ${options}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Procedural Note / Legal Summary <span class="required">*</span></label>
          <textarea id="modal-stage-note" class="form-control" style="min-height:110px;" placeholder="Document filings, court hearings, negotiations, or next steps (this is visible to the client)..." required></textarea>
        </div>
        <div id="modal-stage-error" class="form-error" style="display:none;"></div>
      `,
      `
        <button class="btn btn-outline" id="modal-stage-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-stage-submit">Confirm & Log Milestone</button>
      `
    );

    document.getElementById("modal-stage-cancel").addEventListener("click", closeModal);
    document.getElementById("modal-stage-submit").addEventListener("click", async () => {
      const select = document.getElementById("modal-stage-select");
      const noteInput = document.getElementById("modal-stage-note");
      const errorEl = document.getElementById("modal-stage-error");
      const submitBtn = document.getElementById("modal-stage-submit");

      const newStage = select.value;
      const stageLabel = select.options[select.selectedIndex].text;
      const note = noteInput.value.trim();

      if (!note) {
        errorEl.textContent = "Please provide a legal note describing this milestone transition.";
        errorEl.style.display = "block";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Updating Case...';

      try {
        await updateCaseStatus(caseId, newStage, stageLabel, note, profile);
        closeModal();
        showToast(`Milestone updated to: ${stageLabel}`, "success");
        await loadAll();
      } catch (err) {
        errorEl.textContent = err.message || "Failed to update milestone.";
        errorEl.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Confirm & Log Milestone";
      }
    });
  });

  // File Document Modal
  document.getElementById("upload-doc-btn").addEventListener("click", () => {
    showModal(
      "File Document or Legal Brief",
      `
        <div class="form-group">
          <label class="form-label">Select File <span class="required">*</span></label>
          <input type="file" id="modal-file" class="form-control" accept=".pdf,.png,.jpg,.jpeg,.docx" required>
        </div>
        <div class="form-group">
          <label class="form-label">Document Classification</label>
          <select id="modal-category" class="form-control">
            <option value="pleading">Court Pleading / Motion</option>
            <option value="legal_brief">Legal Brief / Memorandum</option>
            <option value="contract">Executed Contract / Agreement</option>
            <option value="supporting_evidence">Supporting Evidence / Exhibit</option>
            <option value="general">Formal Correspondence</option>
          </select>
        </div>
        <div id="modal-upload-error" class="form-error" style="display:none;"></div>
      `,
      `
        <button class="btn btn-outline" id="modal-upload-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-upload-submit">Upload & File</button>
      `
    );

    document.getElementById("modal-upload-cancel").addEventListener("click", closeModal);
    document.getElementById("modal-upload-submit").addEventListener("click", async () => {
      const fileInput = document.getElementById("modal-file");
      const category = document.getElementById("modal-category").value;
      const errorEl = document.getElementById("modal-upload-error");
      const submitBtn = document.getElementById("modal-upload-submit");

      if (!fileInput.files || !fileInput.files[0]) {
        errorEl.textContent = "Please choose a file to file.";
        errorEl.style.display = "block";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Filing...';

      try {
        await uploadCaseDocument({
          caseId,
          caseTitle: currentCase.caseTitle,
          file: fileInput.files[0],
          category,
          user: profile
        });
        closeModal();
        showToast("Document filed into case record.", "success");
        await loadDocuments(caseId);
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Upload & File";
      }
    });
  });

  loadAll();
});
