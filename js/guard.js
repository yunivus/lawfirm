// Route Guard & Role Enforcement Module
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { auth } from "./firebase-config.js";
import { getCurrentUserProfile, logout, routeForRole } from "./auth.js";
import { showToast, setupSidebar } from "./ui.js";

export function requireRole(allowedRoles = []) {
  return new Promise((resolve) => {
    // Immediate setup of sidebar toggle
    setupSidebar();

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Not logged in -> redirect to login
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }

      try {
        const profile = await getCurrentUserProfile(true);
        if (!profile) {
          showToast("User profile not found. Please log in again.", "error");
          setTimeout(() => logout(), 1000);
          resolve(null);
          return;
        }

        if (profile.status === "suspended") {
          showToast("Your account is currently suspended. Access denied.", "error");
          setTimeout(() => logout(), 1000);
          resolve(null);
          return;
        }

        const role = (profile.role || "client").toLowerCase();
        const expected = Array.isArray(allowedRoles) ? allowedRoles.map(r => r.toLowerCase()) : [allowedRoles.toLowerCase()];

        if (expected.length > 0 && !expected.includes(role)) {
          console.warn(`Role mismatch: user is ${role}, page expects ${expected.join(", ")}`);
          window.location.href = routeForRole(role);
          resolve(null);
          return;
        }

        // Hydrate UI with current user info
        hydrateUserTopbar(profile);

        // Wire Sign out button
        document.querySelectorAll("[data-action='logout']").forEach(btn => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            logout();
          });
        });

        resolve(profile);
      } catch (err) {
        console.error("Guard error:", err);
        showToast("We could not verify your account. Please sign in again.", "error");
        setTimeout(() => logout(), 1000);
        resolve(null);
      }
    });
  });
}

function hydrateUserTopbar(profile) {
  const nameEls = document.querySelectorAll(".user-name, [data-field='userName']");
  nameEls.forEach(el => el.textContent = profile.displayName || profile.email);

  const roleEls = document.querySelectorAll(".user-role, [data-field='userRole']");
  roleEls.forEach(el => el.textContent = profile.role ? profile.role.toUpperCase() : "CLIENT");

  const avatarEls = document.querySelectorAll(".user-avatar, .avatar");
  const initials = (profile.displayName || profile.email || "U")
    .split(" ")
    .map(p => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  avatarEls.forEach(el => el.textContent = initials);
}
