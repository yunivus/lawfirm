// Firebase Configuration & Initialization (LexCounsel)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCeyrhhalcA4fUf7bw1wbm23C2JJPZ_DjM",
  authDomain: "dappled-epigram-59v0l.firebaseapp.com",
  projectId: "dappled-epigram-59v0l",
  storageBucket: "dappled-epigram-59v0l.firebasestorage.app",
  messagingSenderId: "318856420709",
  appId: "1:318856420709:web:1eee866031b14d1b19958c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestoreDatabaseId = "ai-studio-lawfirm-bdc18cc7-c186-4525-a406-88e8dc07357d";
export const db = getFirestore(app, firestoreDatabaseId);
export const storage = getStorage(app);

export const FIRESTORE_COLLECTIONS = {
  USERS: "users",
  CLIENTS: "clients",
  LAWYERS: "lawyers",
  CASES: "cases",
  CASE_STATUS_HISTORY: "caseStatusHistory",
  SERVICE_REQUESTS: "serviceRequests",
  APPOINTMENTS: "appointments",
  DOCUMENTS: "documents",
  CONVERSATIONS: "conversations",
  MESSAGES: "messages",
  INVOICES: "invoices",
  NOTIFICATIONS: "notifications",
  SETTINGS: "settings",
  AUDIT_LOGS: "auditLogs"
};
