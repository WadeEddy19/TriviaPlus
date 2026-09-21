import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.databaseURL && config.projectId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Database | undefined;

if (firebaseConfigured) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getDatabase(app);
}

export function getDb(): Database {
  if (!db) throw new Error('Firebase is not configured.');
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase is not configured.');
  return auth;
}

let authPromise: Promise<User> | undefined;

/** Resolve with the anonymous user, signing in if needed. The uid persists across reloads. */
export function ensureAuth(): Promise<User> {
  if (!authPromise) {
    const a = getFirebaseAuth();
    authPromise = new Promise<User>((resolve, reject) => {
      const unsub = onAuthStateChanged(
        a,
        (user) => {
          if (user) {
            unsub();
            resolve(user);
          } else {
            signInAnonymously(a).catch((e) => {
              unsub();
              authPromise = undefined;
              reject(e);
            });
          }
        },
        (e) => {
          authPromise = undefined;
          reject(e);
        },
      );
    });
  }
  return authPromise;
}
