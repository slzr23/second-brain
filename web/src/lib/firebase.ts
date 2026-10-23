import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Demo mode: fake data, no sign-in. On when asked, or when no Firebase config is set. */
export const isDemo = import.meta.env.VITE_DEMO === "true" || !config.apiKey;

const app = isDemo ? null : initializeApp(config);
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
