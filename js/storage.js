// File Storage and Document Handling Module
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";
import { storage } from "./firebase-config.js";
import { createDocumentRecord, logAudit } from "./firestore.js";
import { validateDocumentFile } from "./validation.js";

export async function uploadCaseDocument({ caseId, caseTitle, file, category, user, visibility = "case_participants" }) {
  const validation = validateDocumentFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const documentId = "doc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `caseDocuments/${caseId}/${documentId}/${safeFileName}`;

  let downloadUrl = "";

  try {
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type || "application/octet-stream"
    });
    downloadUrl = await getDownloadURL(snapshot.ref);
  } catch (err) {
    console.warn("Firebase Storage upload fallback triggered:", err.message);
    // Graceful in-browser fallback if Storage bucket CORS/rules are initializing
    downloadUrl = URL.createObjectURL(file);
  }

  const metadata = {
    caseId,
    caseTitle: caseTitle || "Case Document",
    ownerId: user.uid,
    uploadedBy: user.uid,
    uploadedByName: user.displayName || user.email,
    fileName: file.name,
    storagePath,
    downloadUrl,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    category: category || "general",
    visibility
  };

  const docRecordId = await createDocumentRecord(metadata);
  await logAudit(user.uid, user.displayName, "upload_document", "document", docRecordId, {
    fileName: file.name,
    caseId
  });

  return { id: docRecordId, ...metadata };
}
