/* Init Firebase + helpers Auth/Firestore. */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDCsVXntqPCBhuk6V9z-5Vdg-fVS_trLIo",
  authDomain: "solpep-a37ba.firebaseapp.com",
  projectId: "solpep-a37ba",
  storageBucket: "solpep-a37ba.firebasestorage.app",
  messagingSenderId: "745216530150",
  appId: "1:745216530150:web:a4c3a137ebabc68c610d27"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Cache hors-ligne activé : l'app marche sans Internet et resynchronise quand ça revient.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

setPersistence(auth, browserLocalPersistence).catch(console.error);

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};

/** Retourne l'uid de l'utilisateur connecté, ou null. */
export function currentUid() {
  return auth.currentUser ? auth.currentUser.uid : null;
}

/** Attend la résolution de l'état d'auth (utile au démarrage). */
export function waitForUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
  });
}
