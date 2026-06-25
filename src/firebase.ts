import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA9Sp8BjaMMFTsyecq_ctsDq3si_tu8Bas",
  authDomain: "conciliacion-logistca.firebaseapp.com",
  projectId: "conciliacion-logistca",
  storageBucket: "conciliacion-logistca.firebasestorage.app",
  messagingSenderId: "678083653774",
  appId: "1:678083653774:web:7280508cb091b8efd8d9df"
};

// Initialize Firebase App gracefully
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Retrieve the specific custom Firestore database ID safely.
// getFirestore() is safe to call multiple times (such as during hot module replacement)
// as it returns the existing instance rather than throwing.
const db = getFirestore(app, "ai-studio-7257e416-c916-4773-80bd-ca9334204e28");

export { app, db };

