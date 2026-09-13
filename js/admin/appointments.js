// Admin Appointments Logic
import { requireRole } from "../guard.js";
import { getAppointments, updateAppointmentStatus } from "../firestore.js";
import { formatDate, getStatusBadge, showToast, showConfirm, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["admin"]);
  if (!profile) return;

  const tbody = document.getElementById("apps-tbody");

  async function load() {
    try {
      const list = await getAppointments();
      if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:40px;">No consultations on firm record.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(a => `
        <tr>
          <td>
            <div style="font-weight:600; color:var(--navy);">${formatDate(a.date)}</div>
            <small class="text-muted">${a.startTime || '10:00 AM'}</small>
          </td>
          <td><b>${escapeHtml(a.clientName || "Client")}</b></td>
          <td><b>${escapeHtml(a.lawyerName || "Counsel")}</b></td>
          <td>${escapeHtml(a.caseTitle || "General Consultation")}</td>
          <td class="text-sm">${escapeHtml(a.reason || "Case review")}</td>
          <td>${getStatusBadge(a.status)}</td>
          <td>
            <div style="display:flex; gap:6px;">
              ${a.status === 'pending' ? `
                <button class="btn btn-gold btn-sm confirm-btn" data-id="${a.id}">Confirm</button>
              ` : ''}
              ${a.status !== 'cancelled' ? `
                <button class="btn btn-outline btn-sm cancel-btn" data-id="${a.id}">Cancel</button>
              ` : '<span class="text-xs text-muted">Cancelled</span>'}
            </div>
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll(".confirm-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          await updateAppointmentStatus(btn.dataset.id, "confirmed", profile);
          showToast("Appointment confirmed on firm docket.", "success");
          await load();
        });
      });

      tbody.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          showConfirm("Cancel Consultation", "Are you sure you want to cancel this appointment?", async () => {
            await updateAppointmentStatus(btn.dataset.id, "cancelled", profile);
            showToast("Appointment cancelled.", "info");
            await load();
          });
        });
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Failed to load appointments: ${err.message}</td></tr>`;
    }
  }

  load();
});
