// Firebase Configuration & Initialization (LexCounsel)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyDswRKL67z6jULDB99me28JgQJF9Bk4tek",
  authDomain: "law-firm-management-syst-6c874.firebaseapp.com",
  projectId: "law-firm-management-syst-6c874",
  storageBucket: "law-firm-management-syst-6c874.firebasestorage.app",
  messagingSenderId: "886386926435",
  appId: "1:886386926435:web:b4649c50b8bb8890cda956",
  measurementId: "G-91Q4GQBTQD"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const authPersistence = setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app);
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
