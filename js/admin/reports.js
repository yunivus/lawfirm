// Admin Reports & Export Logic
import { requireRole } from "../guard.js";
import { getCases, getLawyers } from "../firestore.js";
import { formatDate, escapeHtml } from "../ui.js";

const STAGES = [
  { id: "request_submitted", label: "Request Submitted" },
  { id: "lawyer_assigned", label: "Lawyer Assigned" },
  { id: "documents_under_review", label: "Documents Under Review" },
  { id: "case_preparation", label: "Case Preparation" },
  { id: "proceedings", label: "Court / Legal Proceedings" },
  { id: "completed", label: "Case Completed" }
];

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["admin"]);
  if (!profile) return;

  const stageBreakdownEl = document.getElementById("stages-breakdown");
  const practiceBreakdownEl = document.getElementById("practice-breakdown");
  const lawyerAllocTbody = document.getElementById("lawyer-allocation-tbody");
  const exportBtn = document.getElementById("export-csv-btn");

  let allCases = [];
  let allLawyers = [];

  try {
    [allCases, allLawyers] = await Promise.all([
      getCases(),
      getLawyers(false)
    ]);

    renderStageBreakdown(allCases);
    renderPracticeBreakdown(allCases);
    renderLawyerAllocation(allCases, allLawyers);
  } catch (err) {
    console.error("Reports load err:", err);
  }

  function renderStageBreakdown(cases) {
    const total = cases.length || 1;
    const counts = {};
    STAGES.forEach(s => counts[s.id] = 0);
    cases.forEach(c => {
      if (counts[c.status] !== undefined) counts[c.status]++;
    });

    stageBreakdownEl.innerHTML = STAGES.map(s => {
      const cnt = counts[s.id] || 0;
      const pct = Math.round((cnt / total) * 100);
      return `
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span style="font-weight:600; color:var(--navy);">${s.label}</span>
            <span><b>${cnt}</b> (${pct}%)</span>
          </div>
          <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:var(--gold); border-radius:4px;"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderPracticeBreakdown(cases) {
    const total = cases.length || 1;
    const areas = {};
    cases.forEach(c => {
      const a = c.caseType || "General Practice";
      areas[a] = (areas[a] || 0) + 1;
    });

    practiceBreakdownEl.innerHTML = Object.entries(areas).map(([name, cnt]) => {
      const pct = Math.round((cnt / total) * 100);
      return `
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span style="font-weight:600; color:var(--navy);">${escapeHtml(name)}</span>
            <span><b>${cnt}</b> (${pct}%)</span>
          </div>
          <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:var(--navy); border-radius:4px;"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderLawyerAllocation(cases, lawyers) {
    if (!lawyers || lawyers.length === 0) {
      lawyerAllocTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No lawyers registered.</td></tr>`;
      return;
    }

    lawyerAllocTbody.innerHTML = lawyers.map(l => {
      const lid = l.id || l.userId;
      const lawyerCases = cases.filter(c => c.lawyerId === lid);
      const active = lawyerCases.filter(c => c.status !== "completed").length;
      const completed = lawyerCases.filter(c => c.status === "completed").length;

      return `
        <tr>
          <td><b>${escapeHtml(l.displayName || "Counsel")}</b></td>
          <td>${escapeHtml(l.specialization || "General Law")}</td>
          <td><b style="color:var(--navy); font-size:15px;">${active}</b> active</td>
          <td>${completed} closed</td>
          <td><small class="text-muted">${escapeHtml(l.registrationNumber || "BAR-ADMITTED")}</small></td>
        </tr>
      `;
    }).join("");
  }

  // CSV Export functionality
  exportBtn.addEventListener("click", () => {
    if (!allCases || allCases.length === 0) {
      alert("No case data available to export.");
      return;
    }

    const headers = ["Case Reference", "Title", "Client Name", "Client Email", "Assigned Lawyer", "Practice Area", "Status", "Priority", "Date Filed"];
    const rows = allCases.map(c => [
      `LC-${c.id.slice(0, 6).toUpperCase()}`,
      `"${(c.caseTitle || '').replace(/"/g, '""')}"`,
      `"${(c.clientName || '').replace(/"/g, '""')}"`,
      `"${(c.clientEmail || '').replace(/"/g, '""')}"`,
      `"${(c.lawyerName || '').replace(/"/g, '""')}"`,
      `"${(c.caseType || '').replace(/"/g, '""')}"`,
      c.statusLabel || c.status,
      c.priority || 'normal',
      formatDate(c.dateCreated)
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LexCounsel_Firm_Caseload_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
});
