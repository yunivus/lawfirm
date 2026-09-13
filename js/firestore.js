// Firestore Data Layer & CRUD Helpers
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { db, FIRESTORE_COLLECTIONS } from "./firebase-config.js";

// Timestamp Helper
export { serverTimestamp };

// Audit Logging
export async function logAudit(actorId, actorName, action, entityType, entityId, metadata = {}) {
  try {
    await addDoc(collection(db, FIRESTORE_COLLECTIONS.AUDIT_LOGS), {
      actorId: actorId || "system",
      actorName: actorName || "System",
      action,
      entityType,
      entityId,
      metadata,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("Failed to write audit log:", err);
  }
}

// User Profile Helpers
export async function getUserProfile(uid) {
  const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updateUserProfile(uid, data) {
  const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, FIRESTORE_COLLECTIONS.USERS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Lawyers
export async function getLawyers(onlyActive = true) {
  const lawyersCol = collection(db, FIRESTORE_COLLECTIONS.LAWYERS);
  const q = onlyActive ? query(lawyersCol, where("active", "==", true)) : query(lawyersCol);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Legal Service Requests
export async function createServiceRequest(requestData) {
  const docRef = await addDoc(collection(db, FIRESTORE_COLLECTIONS.SERVICE_REQUESTS), {
    ...requestData,
    status: "pending",
    createdAt: serverTimestamp()
  });

  // Notify Admins
  await addDoc(collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS), {
    userId: "admin",
    type: "new_request",
    title: "New Legal Service Request",
    message: `${requestData.clientName || 'A client'} submitted: "${requestData.subject}"`,
    link: "/admin/cases.html",
    read: false,
    createdAt: serverTimestamp()
  });

  return docRef.id;
}

export async function getServiceRequests(clientId = null) {
  const colRef = collection(db, FIRESTORE_COLLECTIONS.SERVICE_REQUESTS);
  let q;
  if (clientId) {
    q = query(colRef, where("clientId", "==", clientId));
  } else {
    q = query(colRef, orderBy("createdAt", "desc"));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Cases
export async function getCases(filter = {}) {
  const colRef = collection(db, FIRESTORE_COLLECTIONS.CASES);
  let q = colRef;
  
  if (filter.clientId) {
    q = query(colRef, where("clientId", "==", filter.clientId));
  } else if (filter.lawyerId) {
    q = query(colRef, where("lawyerId", "==", filter.lawyerId));
  }
  
  const snap = await getDocs(q);
  const cases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Client-side sort by dateCreated descending if available
  return cases.sort((a, b) => {
    const timeA = a.dateCreated?.seconds || 0;
    const timeB = b.dateCreated?.seconds || 0;
    return timeB - timeA;
  });
}

export async function getCaseById(caseId) {
  const docRef = doc(db, FIRESTORE_COLLECTIONS.CASES, caseId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createCase(caseData) {
  const docRef = await addDoc(collection(db, FIRESTORE_COLLECTIONS.CASES), {
    ...caseData,
    dateCreated: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Record initial status history
  await addDoc(collection(db, FIRESTORE_COLLECTIONS.CASE_STATUS_HISTORY), {
    caseId: docRef.id,
    status: caseData.status || "request_submitted",
    statusLabel: caseData.statusLabel || "Request Submitted",
    note: caseData.initialNote || "Case record initialized.",
    changedBy: caseData.createdById || "system",
    changedByName: caseData.createdByName || "System",
    changedAt: serverTimestamp()
  });

  return docRef.id;
}

export async function updateCaseStatus(caseId, status, statusLabel, note, user) {
  const caseRef = doc(db, FIRESTORE_COLLECTIONS.CASES, caseId);
  await updateDoc(caseRef, {
    status,
    statusLabel,
    updatedAt: serverTimestamp()
  });

  // Add status history entry
  await addDoc(collection(db, FIRESTORE_COLLECTIONS.CASE_STATUS_HISTORY), {
    caseId,
    status,
    statusLabel,
    note: note || `Status updated to ${statusLabel}`,
    changedBy: user.uid,
    changedByName: user.displayName || user.email,
    changedAt: serverTimestamp()
  });

  // Fetch case to notify client
  const cSnap = await getDoc(caseRef);
  if (cSnap.exists()) {
    const cData = cSnap.data();
    if (cData.clientId) {
      await addDoc(collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS), {
        userId: cData.clientId,
        type: "status_change",
        title: `Case Status: ${statusLabel}`,
        message: `Your case "${cData.caseTitle}" has moved to: ${statusLabel}.`,
        link: `/client/case.html?id=${caseId}`,
        read: false,
        createdAt: serverTimestamp()
      });
    }
  }

  await logAudit(user.uid, user.displayName, "update_case_status", "case", caseId, { status, statusLabel });
}

export async function assignLawyerToCase(caseId, lawyer, adminUser) {
  const caseRef = doc(db, FIRESTORE_COLLECTIONS.CASES, caseId);
  await updateDoc(caseRef, {
    lawyerId: lawyer.id || lawyer.userId,
    lawyerName: lawyer.displayName || lawyer.name,
    status: "lawyer_assigned",
    statusLabel: "Lawyer Assigned",
    updatedAt: serverTimestamp()
  });

  // Status history
  await addDoc(collection(db, FIRESTORE_COLLECTIONS.CASE_STATUS_HISTORY), {
    caseId,
    status: "lawyer_assigned",
    statusLabel: "Lawyer Assigned",
    note: `Assigned to attorney ${lawyer.displayName || lawyer.name}`,
    changedBy: adminUser.uid,
    changedByName: adminUser.displayName || adminUser.email,
    changedAt: serverTimestamp()
  });

  // Notify lawyer
  await addDoc(collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS), {
    userId: lawyer.id || lawyer.userId,
    type: "case_assigned",
    title: "New Case Assigned",
    message: `You have been assigned to handle case #${caseId.slice(0, 6).toUpperCase()}`,
    link: `/lawyer/case.html?id=${caseId}`,
    read: false,
    createdAt: serverTimestamp()
  });

  await logAudit(adminUser.uid, adminUser.displayName, "assign_lawyer", "case", caseId, { lawyerId: lawyer.id });
}

export async function getCaseStatusHistory(caseId) {
  const colRef = collection(db, FIRESTORE_COLLECTIONS.CASE_STATUS_HISTORY);
  const q = query(colRef, where("caseId", "==", caseId));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return items.sort((a, b) => (b.changedAt?.seconds || 0) - (a.changedAt?.seconds || 0));
}

// Appointments
export async function createAppointment(appData) {
  // Conflict checking
  if (appData.lawyerId && appData.date && appData.startTime) {
    const colRef = collection(db, FIRESTORE_COLLECTIONS.APPOINTMENTS);
    const q = query(
      colRef,
      where("lawyerId", "==", appData.lawyerId),
      where("date", "==", appData.date),
      where("startTime", "==", appData.startTime),
      where("status", "in", ["confirmed", "pending"])
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error("This attorney already has a scheduled appointment during this time slot. Please select another time.");
    }
  }

  const docRef = await addDoc(collection(db, FIRESTORE_COLLECTIONS.APPOINTMENTS), {
    ...appData,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Notify lawyer
  if (appData.lawyerId) {
    await addDoc(collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS), {
      userId: appData.lawyerId,
      type: "new_appointment",
      title: "New Appointment Request",
      message: `Client ${appData.clientName || 'Client'} requested an appointment on ${appData.date} at ${appData.startTime}`,
      link: "/lawyer/appointments.html",
      read: false,
      createdAt: serverTimestamp()
    });
  }

  return docRef.id;
}

export async function getAppointments(filter = {}) {
  const colRef = collection(db, FIRESTORE_COLLECTIONS.APPOINTMENTS);
  let q = colRef;
  if (filter.clientId) {
    q = query(colRef, where("clientId", "==", filter.clientId));
  } else if (filter.lawyerId) {
    q = query(colRef, where("lawyerId", "==", filter.lawyerId));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateAppointmentStatus(appId, status, user) {
  const appRef = doc(db, FIRESTORE_COLLECTIONS.APPOINTMENTS, appId);
  await updateDoc(appRef, {
    status,
    updatedAt: serverTimestamp()
  });
  
  const snap = await getDoc(appRef);
  if (snap.exists()) {
    const data = snap.data();
    if (data.clientId) {
      await addDoc(collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS), {
        userId: data.clientId,
        type: "appointment_update",
        title: `Appointment ${status.toUpperCase()}`,
        message: `Your appointment for ${data.date} at ${data.startTime} is now ${status}.`,
        link: "/client/appointments.html",
        read: false,
        createdAt: serverTimestamp()
      });
    }
  }
}

// Documents
export async function createDocumentRecord(docData) {
  const docRef = await addDoc(collection(db, FIRESTORE_COLLECTIONS.DOCUMENTS), {
    ...docData,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function getDocuments(filter = {}) {
  const colRef = collection(db, FIRESTORE_COLLECTIONS.DOCUMENTS);
  let q = colRef;
  if (filter.caseId) {
    q = query(colRef, where("caseId", "==", filter.caseId));
  } else if (filter.ownerId) {
    q = query(colRef, where("ownerId", "==", filter.ownerId));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Invoices
export async function getInvoices(filter = {}) {
  const colRef = collection(db, FIRESTORE_COLLECTIONS.INVOICES);
  let q = colRef;
  if (filter.clientId) {
    q = query(colRef, where("clientId", "==", filter.clientId));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createInvoice(invoiceData, adminUser) {
  const docRef = await addDoc(collection(db, FIRESTORE_COLLECTIONS.INVOICES), {
    ...invoiceData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (invoiceData.clientId) {
    await addDoc(collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS), {
      userId: invoiceData.clientId,
      type: "invoice_issued",
      title: "New Invoice Issued",
      message: `Invoice for $${invoiceData.amount} (${invoiceData.description || 'Legal Services'}) is now due.`,
      link: "/client/invoices.html",
      read: false,
      createdAt: serverTimestamp()
    });
  }

  await logAudit(adminUser.uid, adminUser.displayName, "create_invoice", "invoice", docRef.id, invoiceData);
  return docRef.id;
}

export async function updateInvoiceStatus(invoiceId, status, user) {
  const invRef = doc(db, FIRESTORE_COLLECTIONS.INVOICES, invoiceId);
  await updateDoc(invRef, {
    status,
    updatedAt: serverTimestamp()
  });
  await logAudit(user.uid, user.displayName, "update_invoice_status", "invoice", invoiceId, { status });
}

// Notifications
export async function getNotificationsForUser(userId) {
  const colRef = collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS);
  const q = query(colRef, where("userId", "in", [userId, "admin"]));
  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function markNotificationAsRead(notifId) {
  const ref = doc(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS, notifId);
  await updateDoc(ref, { read: true });
}

// Firm Settings
export async function getFirmSettings() {
  const ref = doc(db, FIRESTORE_COLLECTIONS.SETTINGS, "firmConfig");
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return {
    firmName: "LexCounsel Legal Services LLP",
    email: "contact@lexcounsel.example",
    phone: "+1 (800) 555-0199",
    address: "500 Chancery Row, Suite 400, New York, NY 10005",
    businessHours: "Monday – Friday: 8:30 AM – 6:00 PM EST"
  };
}

export async function updateFirmSettings(data, user) {
  const ref = doc(db, FIRESTORE_COLLECTIONS.SETTINGS, "firmConfig");
  await setDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  }, { merge: true });
  await logAudit(user.uid, user.displayName, "update_settings", "settings", "firmConfig", data);
}

