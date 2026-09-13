// Client Dashboard Logic
import { requireRole } from "../guard.js";
import { getCases, getAppointments, getDocuments, getInvoices } from "../firestore.js";
import { initNotificationBell, renderNotificationList } from "../notifications.js";
import { formatDate, formatCurrency, getStatusBadge, escapeHtml } from "../ui.js";

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

  try {
    const [cases, appointments, documents, invoices] = await Promise.all([
      getCases({ clientId: profile.id }),
      getAppointments({ clientId: profile.id }),
      getDocuments({ ownerId: profile.id }),
      getInvoices({ clientId: profile.id })
    ]);

    // Update KPI counters
    const activeCases = cases.filter(c => c.status !== "completed");
    document.getElementById("kpi-active-cases").textContent = activeCases.length;

    const todayStr = new Date().toISOString().split("T")[0];
    const upcomingApps = appointments.filter(a => a.date >= todayStr && a.status !== "cancelled");
    document.getElementById("kpi-appointments").textContent = upcomingApps.length;

    document.getElementById("kpi-documents").textContent = documents.length;

    const outstandingBalance = invoices
      .filter(i => i.status === "issued" || i.status === "overdue")
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    document.getElementById("kpi-invoices").textContent = formatCurrency(outstandingBalance);

    // Render Timeline for Most Recent Active Case
    const primaryCase = activeCases[0] || cases[0];
    renderCaseTimeline(primaryCase);

    // Render Cases Table
    renderCasesTable(cases);

    // Render Recent Activity / Notifications
    const activityContainer = document.getElementById("activity-container");
    renderNotificationList(activityContainer, profile.id);

  } catch (err) {
    console.error("Dashboard data load error:", err);
  }
});

function renderCaseTimeline(c) {
  const titleEl = document.getElementById("timeline-case-title");
  const container = document.getElementById("timeline-container");
  const lawyerEl = document.getElementById("timeline-lawyer-info");
  const updatedEl = document.getElementById("timeline-updated-info");

  if (!c) {
    titleEl.textContent = "No Active Legal Matter";
    container.innerHTML = `
      <div class="empty-state" style="padding:20px 0;">
        <p class="text-muted">You do not currently have an ongoing case.</p>
        <a href="services.html" class="btn btn-gold btn-sm mt-2">Submit Service Request →</a>
      </div>
    `;
    lawyerEl.textContent = "";
    updatedEl.textContent = "";
    return;
  }

  titleEl.innerHTML = `<span>${escapeHtml(c.caseTitle)}</span> <small class="text-muted" style="font-weight:normal; margin-left:8px;">#LC-${c.id.slice(0, 6).toUpperCase()}</small>`;
  lawyerEl.innerHTML = `<b>Assigned Attorney:</b> ${escapeHtml(c.lawyerName || "Pending Assignment")}`;
  updatedEl.textContent = `Last updated: ${formatDate(c.updatedAt || c.dateCreated)}`;

  const currentIdx = STAGES.findIndex(s => s.id === c.status);
  const activeIndex = currentIdx >= 0 ? currentIdx : 0;

  container.innerHTML = `
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

function renderCasesTable(cases) {
  const tbody = document.getElementById("cases-table-body");
  if (!tbody) return;

  if (!cases || cases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted" style="padding:32px;">
          You have no cases filed yet. <a href="services.html" style="color:var(--gold); font-weight:600;">Request Legal Service</a>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cases.slice(0, 5).map(c => `
    <tr>
      <td>
        <div style="font-weight:600; color:var(--navy);">${escapeHtml(c.caseTitle)}</div>
        <small class="text-muted">#LC-${c.id.slice(0, 6).toUpperCase()} · Filed ${formatDate(c.dateCreated)}</small>
      </td>
      <td>${escapeHtml(c.caseType || "General Practice")}</td>
      <td>${getStatusBadge(c.status, c.statusLabel)}</td>
      <td>
        <a href="case.html?id=${c.id}" class="btn btn-outline btn-sm">View Timeline →</a>
      </td>
    </tr>
  `).join("");
}
