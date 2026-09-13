// LexCounsel UI Utility Module
export function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
  
  const icon = type === "error" ? "⚠️" : type === "success" ? "✓" : "ℹ";
  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

export function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function formatDate(val) {
  if (!val) return "—";
  let date;
  if (typeof val === "object" && typeof val.toDate === "function") {
    date = val.toDate();
  } else if (val.seconds) {
    date = new Date(val.seconds * 1000);
  } else {
    date = new Date(val);
  }
  if (isNaN(date.getTime())) return String(val);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatDateTime(val) {
  if (!val) return "—";
  let date;
  if (typeof val === "object" && typeof val.toDate === "function") {
    date = val.toDate();
  } else if (val.seconds) {
    date = new Date(val.seconds * 1000);
  } else {
    date = new Date(val);
  }
  if (isNaN(date.getTime())) return String(val);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatCurrency(amount, currency = "USD") {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency
  }).format(num);
}

export function getStatusBadge(status, customLabel = null) {
  const normalized = (status || "pending").toLowerCase().replace(/\s+/g, "_");
  const labels = {
    request_submitted: "Request Submitted",
    lawyer_assigned: "Lawyer Assigned",
    documents_under_review: "Documents Under Review",
    case_preparation: "Case Preparation",
    proceedings: "Court / Proceedings",
    completed: "Case Completed",
    active: "Active",
    pending: "Pending",
    review: "In Review",
    suspended: "Suspended",
    issued: "Issued",
    paid: "Paid",
    partially_paid: "Partially Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
    draft: "Draft"
  };
  const label = customLabel || labels[normalized] || status;
  return `<span class="status-badge status-${normalized}">${escapeHtml(label)}</span>`;
}

export function renderLoading(container, text = "Loading data...") {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <div class="spinner spinner-navy" style="width:28px;height:28px;margin-bottom:12px;"></div>
      <div class="text-sm text-muted">${escapeHtml(text)}</div>
    </div>
  `;
}

export function renderEmptyState(container, title = "No items found", desc = "", actionHtml = "") {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📁</div>
      <div class="empty-state-title">${escapeHtml(title)}</div>
      ${desc ? `<div class="empty-state-desc">${escapeHtml(desc)}</div>` : ""}
      ${actionHtml ? `<div class="mt-3">${actionHtml}</div>` : ""}
    </div>
  `;
}

export function showModal(title, bodyHtml, actionsHtml = "") {
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "app-modal-backdrop";

  backdrop.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <button class="modal-close" id="modal-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${actionsHtml ? `<div class="modal-footer">${actionsHtml}</div>` : ""}
    </div>
  `;

  document.body.appendChild(backdrop);
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
}

export function closeModal() {
  const existing = document.getElementById("app-modal-backdrop");
  if (existing) existing.remove();
}

export function showConfirm(title, message, onConfirm) {
  showModal(
    title,
    `<p style="color:var(--ink);">${escapeHtml(message)}</p>`,
    `
      <button class="btn btn-outline" id="confirm-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="confirm-ok-btn">Confirm</button>
    `
  );
  document.getElementById("confirm-cancel-btn")?.addEventListener("click", closeModal);
  document.getElementById("confirm-ok-btn")?.addEventListener("click", () => {
    closeModal();
    if (typeof onConfirm === "function") onConfirm();
  });
}

export function setupSidebar() {
  const toggle = document.querySelector(".mobile-menu-btn");
  const sidebar = document.querySelector(".sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    document.addEventListener("click", (e) => {
      if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove("open");
      }
    });
  }
}
