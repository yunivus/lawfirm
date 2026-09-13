// Authentication & Session Management Module
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { auth, authPersistence, db, FIRESTORE_COLLECTIONS } from "./firebase-config.js";
import { logAudit } from "./firestore.js";

// Session Cache
let cachedUserProfile = null;

export async function login(email, password) {
  await authPersistence;
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = credential.user;
  
  // Resolve profile & role from Firestore
  let profile = await fetchOrCreateUserProfile(user);
  
  if (profile.status === "suspended") {
    await signOut(auth);
    throw new Error("Your account has been suspended by administration. Please contact support.");
  }
  
  cachedUserProfile = profile;
  await logAudit(user.uid, profile.displayName, "login", "auth", user.uid);
  return profile;
}

export async function registerClient({ name, email, phone, password }) {
  await authPersistence;
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = credential.user;

  await updateProfile(user, { displayName: name });

  const profileData = {
    displayName: name,
    email: email.trim(),
    phone: phone || "",
    role: "client",
    status: "active",
    photoURL: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    try {
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, user.uid), profileData);
    } catch (error) {
      error.message = `User profile could not be saved: ${error.message}`;
      throw error;
    }

    try {
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.CLIENTS, user.uid), {
      userId: user.uid,
      address: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
      });
    } catch (error) {
      error.message = `Client profile could not be saved: ${error.message}`;
      throw error;
    }

    cachedUserProfile = { id: user.uid, ...profileData };
    await logAudit(user.uid, name, "register", "user", user.uid);
    return cachedUserProfile;
  } catch (error) {
    await deleteUser(user).catch(() => {});
    throw error;
  }
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logout() {
  cachedUserProfile = null;
  await signOut(auth);
  window.location.href = "/login.html";
}

export async function getCurrentUserProfile(forceRefresh = false) {
  if (cachedUserProfile && !forceRefresh) return cachedUserProfile;
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, currentUser.uid));
  if (snap.exists()) {
    cachedUserProfile = { id: snap.id, ...snap.data() };
    return cachedUserProfile;
  }
  return null;
}

// Fallback / Self-healing helper for users created via Auth or Quick-Login
async function fetchOrCreateUserProfile(user, preferredRole = "client") {
  const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, user.uid);
  const snap = await getDoc(userRef);
  
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  // Create default profile if missing
  const newProfile = {
    displayName: user.displayName || user.email.split("@")[0],
    email: user.email,
    role: preferredRole,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(userRef, newProfile);
  return { id: user.uid, ...newProfile };
}

export function routeForRole(role) {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "/admin/dashboard.html";
    case "lawyer":
      return "/lawyer/dashboard.html";
    case "client":
    default:
      return "/client/dashboard.html";
  }
}

export function redirectToRoleDashboard(role) {
  window.location.replace(routeForRole(role));
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const profile = await getCurrentUserProfile();
      callback(user, profile);
    } else {
      cachedUserProfile = null;
      callback(null, null);
    }
  });
}
