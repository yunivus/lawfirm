// Lawyer Appointments Logic
import { requireRole } from "../guard.js";
import { getAppointments, updateAppointmentStatus } from "../firestore.js";
import { formatDate, getStatusBadge, showToast, showConfirm, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["lawyer"]);
  if (!profile) return;

  const tbody = document.getElementById("lawyer-apps-tbody");

  async function load() {
    try {
      const list = await getAppointments({ lawyerId: profile.id });
      if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:40px;">No consultations scheduled.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(a => `
        <tr>
          <td>
            <div style="font-weight:600; color:var(--navy);">${formatDate(a.date)}</div>
            <small class="text-muted">${a.startTime || '10:00 AM'}</small>
          </td>
          <td>
            <div style="font-weight:600;">${escapeHtml(a.clientName || "Client")}</div>
          </td>
          <td>${escapeHtml(a.caseTitle || "General Consultation")}</td>
          <td class="text-sm">${escapeHtml(a.reason || "Legal advisory")}</td>
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
          showToast("Appointment confirmed and marked on docket.", "success");
          await load();
        });
      });

      tbody.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          showConfirm("Cancel Consultation", "Are you sure you want to cancel this consultation?", async () => {
            await updateAppointmentStatus(btn.dataset.id, "cancelled", profile);
            showToast("Consultation cancelled.", "info");
            await load();
          });
        });
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Failed to load appointments: ${err.message}</td></tr>`;
    }
  }

  load();
});
