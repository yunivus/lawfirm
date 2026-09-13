// Client Service Request Logic
import { requireRole } from "../guard.js";
import { createServiceRequest, createCase } from "../firestore.js";
import { uploadCaseDocument } from "../storage.js";
import { validateServiceRequest, validateDocumentFile } from "../validation.js";
import { showToast } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["client"]);
  if (!profile) return;

  const form = document.getElementById("service-request-form");
  const errorEl = document.getElementById("form-error");
  const submitBtn = document.getElementById("submit-btn");
  const dropzone = document.getElementById("file-dropzone");
  const fileInput = document.getElementById("file-input");
  const fileNameDisplay = document.getElementById("file-name-display");

  let selectedFile = null;

  // File Dropzone setup
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  function handleFileSelected(file) {
    const val = validateDocumentFile(file);
    if (!val.valid) {
      alert(val.error);
      return;
    }
    selectedFile = file;
    fileNameDisplay.textContent = `Attached: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    fileNameDisplay.style.display = "block";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";

    const serviceType = document.getElementById("service-type").value;
    const priority = document.getElementById("priority").value;
    const subject = document.getElementById("subject").value;
    const description = document.getElementById("description").value;

    const val = validateServiceRequest({ serviceType, subject, description });
    if (!val.valid) {
      errorEl.textContent = Object.values(val.errors)[0];
      errorEl.style.display = "block";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Submitting Request...';

    try {
      // 1. Create Formal Case Record in initial "request_submitted" stage
      const caseId = await createCase({
        clientId: profile.id,
        clientName: profile.displayName || profile.email,
        clientEmail: profile.email,
        lawyerId: null,
        lawyerName: "Pending Assignment",
        caseTitle: subject.trim(),
        description: description.trim(),
        caseType: serviceType,
        priority: priority,
        status: "request_submitted",
        statusLabel: "Request Submitted",
        initialNote: `Client initiated legal service request for ${serviceType}.`
      });

      // 2. Create Service Request record for administrative review
      await createServiceRequest({
        caseId,
        clientId: profile.id,
        clientName: profile.displayName || profile.email,
        serviceType,
        subject: subject.trim(),
        description: description.trim(),
        priority
      });

      // 3. Upload attachment if provided
      if (selectedFile) {
        submitBtn.innerHTML = '<span class="spinner"></span> Uploading Supporting Document...';
        await uploadCaseDocument({
          caseId,
          caseTitle: subject.trim(),
          file: selectedFile,
          category: "supporting_evidence",
          user: profile
        });
      }

      showToast("Legal service request submitted successfully! Case initialized.", "success");
      setTimeout(() => {
        window.location.href = `/client/case.html?id=${caseId}`;
      }, 1000);

    } catch (err) {
      console.error("Service request error:", err);
      errorEl.textContent = err.message || "Failed to submit request. Please try again.";
      errorEl.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.innerHTML = "<span>Submit Legal Request →</span>";
    }
  });
});
