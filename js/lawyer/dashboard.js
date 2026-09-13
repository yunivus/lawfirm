// Lawyer Dashboard Logic
import { requireRole } from "../guard.js";
import { getCases, getAppointments, updateAppointmentStatus } from "../firestore.js";
import { formatDate, getStatusBadge, showToast, showConfirm, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["lawyer"]);
  if (!profile) return;

  const casesTbody = document.getElementById("active-cases-tbody");
  const appsTbody = document.getElementById("appointments-tbody");

  try {
    const [allCases, allAppointments] = await Promise.all([
      getCases({ lawyerId: profile.id }),
      getAppointments({ lawyerId: profile.id })
    ]);

    const activeCases = allCases.filter(c => c.status !== "completed");
    const completedCases = allCases.filter(c => c.status === "completed");
    const proceedingsCases = allCases.filter(c => c.status === "proceedings");

    const todayStr = new Date().toISOString().split("T")[0];
    const upcomingApps = allAppointments.filter(a => a.date >= todayStr && a.status !== "cancelled");

    document.getElementById("kpi-active-cases").textContent = activeCases.length;
    document.getElementById("kpi-appointments").textContent = upcomingApps.length;
    document.getElementById("kpi-proceedings").textContent = proceedingsCases.length;
    document.getElementById("kpi-completed").textContent = completedCases.length;

    renderActiveCases(activeCases);
    renderAppointments(upcomingApps, profile);

  } catch (err) {
    console.error("Lawyer dashboard load error:", err);
  }

  function renderActiveCases(cases) {
    if (!cases || cases.length === 0) {
      casesTbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted" style="padding:32px;">
            No active matters assigned to your caseload currently.
          </td>
        </tr>
      `;
      return;
    }

    casesTbody.innerHTML = cases.slice(0, 6).map(c => `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--navy);">${escapeHtml(c.caseTitle)}</div>
          <small class="text-muted">#LC-${c.id.slice(0, 6).toUpperCase()} · ${c.caseType || 'General'}</small>
        </td>
        <td><b>${escapeHtml(c.clientName || "Client")}</b></td>
        <td>${getStatusBadge(c.status, c.statusLabel)}</td>
        <td>
          <span style="font-size:12px; font-weight:700; color:${c.priority === 'critical' || c.priority === 'high' ? 'var(--red)' : 'var(--navy)'};">
            ${(c.priority || 'Normal').toUpperCase()}
          </span>
        </td>
        <td>${formatDate(c.updatedAt || c.dateCreated)}</td>
        <td>
          <a href="case.html?id=${c.id}" class="btn btn-primary btn-sm">Manage Matter →</a>
        </td>
      </tr>
    `).join("");
  }

  function renderAppointments(apps, user) {
    if (!apps || apps.length === 0) {
      appsTbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted" style="padding:32px;">
            No upcoming client consultations on the docket.
          </td>
        </tr>
      `;
      return;
    }

    appsTbody.innerHTML = apps.slice(0, 5).map(a => `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--navy);">${formatDate(a.date)}</div>
          <small class="text-muted">${a.startTime || '10:00 AM'}</small>
        </td>
        <td><b>${escapeHtml(a.clientName || "Client")}</b></td>
        <td>${escapeHtml(a.caseTitle || "General Consultation")}</td>
        <td class="text-sm">${escapeHtml(a.reason || "Legal strategy")}</td>
        <td>${getStatusBadge(a.status)}</td>
        <td>
          ${a.status === 'pending' ? `
            <button class="btn btn-gold btn-sm confirm-btn" data-id="${a.id}">Confirm</button>
          ` : `<span class="text-xs text-muted">Confirmed</span>`}
        </td>
      </tr>
    `).join("");

    appsTbody.querySelectorAll(".confirm-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        await updateAppointmentStatus(btn.dataset.id, "confirmed", user);
        showToast("Consultation confirmed.", "success");
        btn.replaceWith(document.createTextNode("Confirmed"));
      });
    });
  }
});
