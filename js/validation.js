// Form Validation Helpers
export function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export function validatePassword(password) {
  if (!password || typeof password !== "string") return false;
  // Minimum 6 characters for Firebase Auth
  return password.length >= 6;
}

export function validateRegistration({ name, email, password, confirmPassword }) {
  const errors = {};
  if (!name || name.trim().length < 2) {
    errors.name = "Full name must be at least 2 characters.";
  }
  if (!validateEmail(email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!validatePassword(password)) {
    errors.password = "Password must be at least 6 characters.";
  }
  if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateServiceRequest({ serviceType, subject, description }) {
  const errors = {};
  if (!serviceType) {
    errors.serviceType = "Please select a service type.";
  }
  if (!subject || subject.trim().length < 3) {
    errors.subject = "Subject must be at least 3 characters.";
  }
  if (!description || description.trim().length < 10) {
    errors.description = "Please provide at least 10 characters describing your case.";
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateAppointment({ lawyerId, date, startTime, reason }) {
  const errors = {};
  if (!date) {
    errors.date = "Please select an appointment date.";
  } else {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      errors.date = "Appointment date cannot be in the past.";
    }
  }
  if (!startTime) {
    errors.startTime = "Please select a preferred time slot.";
  }
  if (!reason || reason.trim().length < 5) {
    errors.reason = "Please enter the purpose of this appointment (at least 5 characters).";
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateDocumentFile(file, maxBytes = 10 * 1024 * 1024) {
  if (!file) return { valid: false, error: "Please select a file to upload." };
  
  const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".docx"];
  const fileName = file.name.toLowerCase();
  const hasValidExt = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExt) {
    return {
      valid: false,
      error: "Only PDF, PNG, JPG, and DOCX files are allowed."
    };
  }

  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File size exceeds the limit (${(maxBytes / (1024 * 1024)).toFixed(0)}MB maximum).`
    };
  }

  return { valid: true, error: null };
}
