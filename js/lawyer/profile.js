// Lawyer Profile Logic
import { requireRole } from "../guard.js";
import { getLawyerProfile, saveLawyerProfile, updateUserProfile } from "../firestore.js";
import { showToast } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["lawyer"]);
  if (!profile) return;

  const nameInput = document.getElementById("l-name");
  const emailInput = document.getElementById("l-email");
  const barInput = document.getElementById("l-bar");
  const specSelect = document.getElementById("l-spec");
  const bioInput = document.getElementById("l-bio");
  const availInput = document.getElementById("l-avail");
  const msgEl = document.getElementById("prof-msg");
  const form = document.getElementById("lawyer-profile-form");
  const saveBtn = document.getElementById("l-save-btn");

  nameInput.value = profile.displayName || "";
  emailInput.value = profile.email || "";

  try {
    const lData = await getLawyerProfile(profile.id);
    if (lData) {
      barInput.value = lData.registrationNumber || "";
      if (lData.specialization) specSelect.value = lData.specialization;
      bioInput.value = lData.bio || "";
      availInput.value = lData.availability || "";
    }
  } catch (err) {
    console.warn("Lawyer profile load err:", err);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.style.display = "none";
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      await updateUserProfile(profile.id, {
        displayName: nameInput.value.trim()
      });

      await saveLawyerProfile(profile.id, {
        displayName: nameInput.value.trim(),
        registrationNumber: barInput.value.trim(),
        specialization: specSelect.value,
        bio: bioInput.value.trim(),
        availability: availInput.value.trim(),
        active: true
      });

      showToast("Attorney profile updated successfully.", "success");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Profile Details";
    } catch (err) {
      msgEl.textContent = err.message || "Failed to update profile.";
      msgEl.className = "form-error mb-3";
      msgEl.style.display = "block";
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Profile Details";
    }
  });
});
