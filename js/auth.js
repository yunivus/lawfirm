// Authentication & Session Management Module
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
import { auth, db, FIRESTORE_COLLECTIONS } from "./firebase-config.js";
import { seedInitialDataIfEmpty, logAudit } from "./firestore.js";

// Session Cache
let cachedUserProfile = null;

export async function login(email, password) {
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

  // Save to users/{uid}
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, user.uid), profileData);

  // Save to clients/{uid}
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.CLIENTS, user.uid), {
    userId: user.uid,
    address: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  cachedUserProfile = { id: user.uid, ...profileData };
  await logAudit(user.uid, name, "register", "user", user.uid);
  return cachedUserProfile;
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

// Quick / Demo Role Login for rapid evaluation & testing
export async function quickDemoLogin(role = "client") {
  await seedInitialDataIfEmpty();

  const accounts = {
    admin: { email: "admin@lexcounsel.example", pass: "LexAdmin2026!", name: "Avery Morgan (Admin)" },
    lawyer: { email: "sarah.jenkins@lexcounsel.example", pass: "LexLawyer2026!", name: "Sarah Jenkins, Esq." },
    client: { email: "jordan.reed@example.com", pass: "LexClient2026!", name: "Jordan Reed (Client)" }
  };

  const creds = accounts[role] || accounts.client;

  try {
    // Attempt sign in
    return await login(creds.email, creds.pass);
  } catch (err) {
    // If account does not exist in Auth yet, create it
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
      try {
        const credential = await createUserWithEmailAndPassword(auth, creds.email, creds.pass);
        const user = credential.user;
        await updateProfile(user, { displayName: creds.name });

        const profileData = {
          displayName: creds.name,
          email: creds.email,
          role: role,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, user.uid), profileData);

        if (role === "client") {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.CLIENTS, user.uid), {
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else if (role === "lawyer") {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.LAWYERS, user.uid), {
            userId: user.uid,
            displayName: creds.name,
            email: creds.email,
            specialization: "Corporate & Commercial Law",
            registrationNumber: "BAR-NY-849201",
            bio: "Senior counsel specializing in corporate governance, compliance, and contracts.",
            availability: "Monday - Friday (9 AM - 5 PM)",
            active: true,
            createdAt: serverTimestamp()
          });
        }

        cachedUserProfile = { id: user.uid, ...profileData };
        return cachedUserProfile;
      } catch (createErr) {
        throw new Error(createErr.message || "Failed to create demo account.");
      }
    }
    throw err;
  }
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
