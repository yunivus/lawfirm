// Client Appointments Logic
import { requireRole } from "../guard.js";
import { getAppointments, createAppointment, updateAppointmentStatus, getCases, getLawyers } from "../firestore.js";
import { initNotificationBell } from "../notifications.js";
import { validateAppointment } from "../validation.js";
import { formatDate, getStatusBadge, showToast, showModal, closeModal, showConfirm, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["client"]);
  if (!profile) return;

  initNotificationBell(profile.id);

  const tbody = document.getElementById("appointments-tbody");
  const bookBtn = document.getElementById("book-modal-btn");

  let cases = [];
  let lawyers = [];

  try {
    [cases, lawyers] = await Promise.all([
      getCases({ clientId: profile.id }),
      getLawyers(true)
    ]);
    await loadAppointments();
  } catch (err) {
    console.error("Init error:", err);
  }

  async function loadAppointments() {
    try {
      const appointments = await getAppointments({ clientId: profile.id });
      if (!appointments || appointments.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-muted" style="padding:40px 20px;">
              You have no scheduled consultations yet.
              <div class="mt-2">
                <button class="btn btn-gold btn-sm" id="empty-book-btn">Schedule Consultation →</button>
              </div>
            </td>
          </tr>
        `;
        document.getElementById("empty-book-btn")?.addEventListener("click", openBookModal);
        return;
      }

      tbody.innerHTML = appointments.map(a => `
        <tr>
          <td>
            <div style="font-weight:600; color:var(--navy);">${formatDate(a.date)}</div>
            <small class="text-muted">${a.startTime || '10:00 AM'}</small>
          </td>
          <td><b>${escapeHtml(a.lawyerName || "Assigned Attorney")}</b></td>
          <td>${escapeHtml(a.caseTitle || "General Consultation")}</td>
          <td style="max-width:240px;"><div class="text-sm">${escapeHtml(a.reason || "Case review")}</div></td>
          <td>${getStatusBadge(a.status)}</td>
          <td>
            ${a.status !== 'cancelled' ? `<button class="btn btn-outline btn-sm cancel-app-btn" data-id="${a.id}">Cancel</button>` : '<span class="text-muted text-xs">—</span>'}
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll(".cancel-app-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          showConfirm("Cancel Appointment", "Are you sure you wish to cancel this scheduled consultation?", async () => {
            await updateAppointmentStatus(btn.dataset.id, "cancelled", profile);
            showToast("Appointment cancelled.", "info");
            await loadAppointments();
          });
        });
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Failed to load appointments: ${err.message}</td></tr>`;
    }
  }

  function openBookModal() {
    const caseOptions = cases.map(c => `<option value="${c.id}" data-lawyer="${c.lawyerId || ''}" data-lawyer-name="${c.lawyerName || ''}">${escapeHtml(c.caseTitle)}</option>`).join("");
    const lawyerOptions = lawyers.map(l => `<option value="${l.id || l.userId}">${escapeHtml(l.displayName)} (${escapeHtml(l.specialization)})</option>`).join("");

    showModal(
      "Schedule Legal Consultation",
      `
        <div class="form-group">
          <label class="form-label">Related Legal Matter</label>
          <select id="app-case-select" class="form-control">
            <option value="">-- General / Pre-Case Consultation --</option>
            ${caseOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Attorney <span class="required">*</span></label>
          <select id="app-lawyer-select" class="form-control" required>
            ${lawyerOptions}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Preferred Date <span class="required">*</span></label>
            <input type="date" id="app-date" class="form-control" min="${new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Time Slot <span class="required">*</span></label>
            <select id="app-time" class="form-control" required>
              <option value="09:00 AM">09:00 AM - 09:45 AM</option>
              <option value="10:30 AM" selected>10:30 AM - 11:15 AM</option>
              <option value="01:30 PM">01:30 PM - 02:15 PM</option>
              <option value="03:00 PM">03:00 PM - 03:45 PM</option>
              <option value="04:30 PM">04:30 PM - 05:15 PM</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Consultation Agenda / Notes <span class="required">*</span></label>
          <textarea id="app-reason" class="form-control" placeholder="Specify what you wish to discuss with counsel..." required></textarea>
        </div>
        <div id="modal-app-error" class="form-error" style="display:none;"></div>
      `,
      `
        <button class="btn btn-outline" id="modal-cancel-btn">Cancel</button>
        <button class="btn btn-gold" id="modal-submit-btn">Request Booking</button>
      `
    );

    document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
    document.getElementById("modal-submit-btn").addEventListener("click", async () => {
      const caseSelect = document.getElementById("app-case-select");
      const lawyerSelect = document.getElementById("app-lawyer-select");
      const date = document.getElementById("app-date").value;
      const startTime = document.getElementById("app-time").value;
      const reason = document.getElementById("app-reason").value;
      const errorEl = document.getElementById("modal-app-error");
      const submitBtn = document.getElementById("modal-submit-btn");

      const lawyerId = lawyerSelect.value;
      const lawyerName = lawyerSelect.options[lawyerSelect.selectedIndex]?.text || "Counsel";
      const caseId = caseSelect.value || null;
      const caseTitle = caseSelect.options[caseSelect.selectedIndex]?.text || "General Matter";

      const val = validateAppointment({ lawyerId, date, startTime, reason });
      if (!val.valid) {
        errorEl.textContent = Object.values(val.errors)[0];
        errorEl.style.display = "block";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Checking Availability...';

      try {
        await createAppointment({
          clientId: profile.id,
          clientName: profile.displayName || profile.email,
          lawyerId,
          lawyerName,
          caseId,
          caseTitle,
          date,
          startTime,
          reason
        });

        closeModal();
        showToast("Consultation requested successfully. Counsel has been notified.", "success");
        await loadAppointments();
      } catch (err) {
        errorEl.textContent = err.message || "Failed to schedule appointment.";
        errorEl.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Request Booking";
      }
    });
  }

  bookBtn.addEventListener("click", openBookModal);
});
