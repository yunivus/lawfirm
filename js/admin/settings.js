// Admin Settings Logic
import { requireRole } from "../guard.js";
import { getDocRef, setDocData, getDocData } from "../firestore.js";
import { showToast } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["admin"]);
  if (!profile) return;

  const firmNameInput = document.getElementById("firm-name");
  const firmEmailInput = document.getElementById("firm-email");
  const firmPhoneInput = document.getElementById("firm-phone");
  const firmAddressInput = document.getElementById("firm-address");
  const firmHoursInput = document.getElementById("firm-hours");
  const form = document.getElementById("settings-form");
  const saveBtn = document.getElementById("save-settings-btn");

  try {
    const existing = await getDocData("firmSettings", "main");
    if (existing) {
      if (existing.firmName) firmNameInput.value = existing.firmName;
      if (existing.firmEmail) firmEmailInput.value = existing.firmEmail;
      if (existing.firmPhone) firmPhoneInput.value = existing.firmPhone;
      if (existing.firmAddress) firmAddressInput.value = existing.firmAddress;
      if (existing.firmHours) firmHoursInput.value = existing.firmHours;
    }
  } catch (err) {
    console.warn("Firm settings load err:", err);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      await setDocData("firmSettings", "main", {
        firmName: firmNameInput.value.trim(),
        firmEmail: firmEmailInput.value.trim(),
        firmPhone: firmPhoneInput.value.trim(),
        firmAddress: firmAddressInput.value.trim(),
        firmHours: firmHoursInput.value.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: profile.id
      });

      showToast("Firm settings updated successfully.", "success");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Settings";
    } catch (err) {
      alert("Error saving settings: " + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Settings";
    }
  });
});
