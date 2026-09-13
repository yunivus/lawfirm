// Admin Users & Staff Governance Logic
import { requireRole } from "../guard.js";
import { getUsers, setUserStatus, createUserAccountByAdmin } from "../firestore.js";
import { formatDate, getStatusBadge, showToast, showModal, closeModal, showConfirm, escapeHtml } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["admin"]);
  if (!profile) return;

  const tbody = document.getElementById("users-tbody");
  const searchInput = document.getElementById("user-search");
  const roleFilter = document.getElementById("role-filter");
  const addStaffBtn = document.getElementById("add-staff-btn");

  let allUsers = [];

  async function load() {
    try {
      allUsers = await getUsers();
      render();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Error loading users: ${err.message}</td></tr>`;
    }
  }

  function render() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const r = roleFilter.value;

    const filtered = allUsers.filter(u => {
      const matchQ = !q || (u.displayName || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (u.role || "").toLowerCase().includes(q);
      const matchR = !r || (u.role || "").toLowerCase() === r;
      return matchQ && matchR;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:32px;">No users found matching query.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(u => `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--navy);">${escapeHtml(u.displayName || "User")}</div>
          <small class="text-muted">${escapeHtml(u.email || "")}</small>
        </td>
        <td>
          <span class="status-badge" style="background:#f1f5f9; color:var(--navy); text-transform:uppercase; font-size:11px;">
            ${escapeHtml(u.role || "client")}
          </span>
        </td>
        <td>${getStatusBadge(u.status || "active")}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td>
          ${u.id !== profile.id ? `
            <button class="btn btn-outline btn-sm toggle-status-btn" data-id="${u.id}" data-current="${u.status || 'active'}" data-name="${escapeHtml(u.displayName || u.email)}">
              ${u.status === 'suspended' ? 'Activate Account' : 'Suspend Access'}
            </button>
          ` : '<span class="text-xs text-muted">Current Session</span>'}
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".toggle-status-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const current = btn.dataset.current;
        const name = btn.dataset.name;
        const nextStatus = current === "suspended" ? "active" : "suspended";

        showConfirm(
          `${nextStatus === 'suspended' ? 'Suspend' : 'Activate'} User`,
          `Are you sure you want to set ${name}'s status to ${nextStatus.toUpperCase()}?`,
          async () => {
            await setUserStatus(id, nextStatus, profile);
            showToast(`User ${name} is now ${nextStatus}.`, "success");
            await load();
          }
        );
      });
    });
  }

  // Onboard staff modal
  addStaffBtn.addEventListener("click", () => {
    showModal(
      "Onboard Firm Attorney or Staff",
      `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Legal Name <span class="required">*</span></label>
            <input type="text" id="staff-name" class="form-control" placeholder="e.g. Elena Rostova, Esq." required>
          </div>
          <div class="form-group">
            <label class="form-label">Firm Role <span class="required">*</span></label>
            <select id="staff-role" class="form-control">
              <option value="lawyer" selected>Attorney / Counsel</option>
              <option value="admin">Firm Administrator</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Work Email <span class="required">*</span></label>
            <input type="email" id="staff-email" class="form-control" placeholder="elena@lexcounsel.example" required>
          </div>
          <div class="form-group">
            <label class="form-label">Initial Password <span class="required">*</span></label>
            <input type="password" id="staff-pass" class="form-control" placeholder="Min 6 characters" value="LexCounsel2026!" required>
          </div>
        </div>

        <div id="lawyer-extra-fields">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Bar Registration #</label>
              <input type="text" id="staff-bar" class="form-control" placeholder="e.g. BAR-NY-772183">
            </div>
            <div class="form-group">
              <label class="form-label">Primary Practice Area</label>
              <select id="staff-spec" class="form-control">
                <option value="Corporate & Commercial Law">Corporate & Commercial Law</option>
                <option value="Litigation & Dispute Resolution">Litigation & Dispute Resolution</option>
                <option value="Family Law & Domestic Relations">Family Law & Domestic Relations</option>
                <option value="Real Estate & Property">Real Estate & Property</option>
                <option value="Intellectual Property">Intellectual Property</option>
              </select>
            </div>
          </div>
        </div>

        <div id="modal-staff-error" class="form-error" style="display:none;"></div>
      `,
      `
        <button class="btn btn-outline" id="staff-cancel">Cancel</button>
        <button class="btn btn-gold" id="staff-submit">Create Account</button>
      `
    );

    document.getElementById("staff-cancel").addEventListener("click", closeModal);
    document.getElementById("staff-submit").addEventListener("click", async () => {
      const name = document.getElementById("staff-name").value.trim();
      const role = document.getElementById("staff-role").value;
      const email = document.getElementById("staff-email").value.trim();
      const pass = document.getElementById("staff-pass").value;
      const bar = document.getElementById("staff-bar")?.value.trim() || "";
      const spec = document.getElementById("staff-spec")?.value || "";
      const errorEl = document.getElementById("modal-staff-error");
      const submitBtn = document.getElementById("staff-submit");

      if (!name || !email || !pass) {
        errorEl.textContent = "Please fill in all required fields.";
        errorEl.style.display = "block";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Creating Account...';

      try {
        await createUserAccountByAdmin({
          email,
          password: pass,
          displayName: name,
          role,
          specialization: spec,
          registrationNumber: bar,
          adminUser: profile
        });

        closeModal();
        showToast(`Account created for ${name} (${role.toUpperCase()}).`, "success");
        await load();
      } catch (err) {
        errorEl.textContent = err.message || "Failed to create staff account.";
        errorEl.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Create Account";
      }
    });
  });

  searchInput.addEventListener("input", render);
  roleFilter.addEventListener("change", render);

  load();
});
