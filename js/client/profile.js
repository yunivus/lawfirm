// Client Profile Logic
import { requireRole } from "../guard.js";
import { getUserProfile, updateUserProfile, getClientProfile, saveClientProfile } from "../firestore.js";
import { initNotificationBell } from "../notifications.js";
import { showToast } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["client"]);
  if (!profile) return;

  initNotificationBell(profile.id);

  const nameInput = document.getElementById("prof-name");
  const emailInput = document.getElementById("prof-email");
  const phoneInput = document.getElementById("prof-phone");
  const addressInput = document.getElementById("prof-address");
  const emergencyInput = document.getElementById("prof-emergency");
  const statusEl = document.getElementById("profile-status");
  const form = document.getElementById("profile-form");
  const saveBtn = document.getElementById("save-btn");

  nameInput.value = profile.displayName || "";
  emailInput.value = profile.email || "";
  phoneInput.value = profile.phone || "";

  try {
    const clientData = await getClientProfile(profile.id);
    if (clientData) {
      addressInput.value = clientData.address || "";
      emergencyInput.value = clientData.emergencyContact || "";
    }
  } catch (err) {
    console.warn("Client profile load err:", err);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.style.display = "none";
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      await updateUserProfile(profile.id, {
        displayName: nameInput.value.trim(),
        phone: phoneInput.value.trim()
      });

      await saveClientProfile(profile.id, {
        address: addressInput.value.trim(),
        emergencyContact: emergencyInput.value.trim()
      });

      showToast("Profile updated successfully.", "success");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    } catch (err) {
      statusEl.textContent = err.message || "Failed to update profile.";
      statusEl.className = "form-error mb-3 text-sm";
      statusEl.style.display = "block";
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  });
});
