import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, onSnapshot, serverTimestamp, Timestamp, runTransaction,
  query, where, limit
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const cfg = window.TAHDIA_FIREBASE_CONFIG;

function safeJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
function read(key) {
  try { return localStorage.getItem(key) || ""; } catch { return ""; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
function stableFallbackId() {
  let id = read("tahdia_guest_id");
  if (!id) {
    id = "guest_" + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^a-zA-Z0-9_-]/g, "");
    write("tahdia_guest_id", id);
  }
  return id;
}
function resolvedName(id, firebaseUser) {
  const social = window.BS_SOCIAL?.profile?.();
  const player = safeJson("tahadi-player");
  const candidates = [
    firebaseUser?.displayName,
    social?.displayName,
    social?.name,
    player?.name,
    read("online_name"),
    read("tahdia_guest_name")
  ];
  const found = candidates.map((x) => String(x || "").trim()).find((x) => x && x !== "لاعب" && x !== "لاعب العباقرة");
  if (found) {
    const clean = found.slice(0, 20);
    write("online_name", clean);
    return clean;
  }
  const suffix = String(id || stableFallbackId()).replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || String(Math.floor(1000 + Math.random() * 9000));
  const guestName = `عبقري ${suffix}`;
  write("tahdia_guest_name", guestName);
  write("online_name", guestName);
  return guestName;
}

if (!cfg) {
  window.TahdiaOnlineError = "Firebase config missing";
  window.dispatchEvent(new Event("tahdia-firebase-error"));
} else {
  try {
    const app = initializeApp(cfg);
    const auth = getAuth(app);
    const db = getFirestore(app);

    let identityPromise = null;
    async function ensureIdentity() {
      if (identityPromise) return identityPromise;
      identityPromise = (async () => {
        let user = auth.currentUser;
        if (!user) {
          try {
            const cred = await signInAnonymously(auth);
            user = cred.user;
          } catch (error) {
            // Firestore can still be used with the current testing rules. Keep a stable local guest id.
            window.TahdiaOnlineError = error?.message || String(error);
          }
        }
        const id = user?.uid || stableFallbackId();
        return { id, uid: user?.uid || null, name: resolvedName(id, user), authenticated: Boolean(user) };
      })();
      try { return await identityPromise; }
      catch (error) { identityPromise = null; throw error; }
    }

    window.TahdiaOnline = {
      app, auth, db,
      collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
      getDoc, getDocs, onSnapshot, serverTimestamp, Timestamp, runTransaction,
      query, where, limit,
      ensureIdentity,
      resolvePlayerName: resolvedName,
      ready: true
    };
    window.dispatchEvent(new Event("tahdia-firebase-ready"));
    // Warm up anonymous auth, but never block the UI on it.
    ensureIdentity().then((identity) => {
      window.TahdiaOnline.identity = identity;
      window.dispatchEvent(new CustomEvent("tahdia-identity-ready", { detail: identity }));
    }).catch(() => {});
  } catch (error) {
    window.TahdiaOnlineError = error?.message || String(error);
    window.dispatchEvent(new Event("tahdia-firebase-error"));
  }
}
