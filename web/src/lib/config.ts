export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Demo mode: fake data, no sign-in, Firebase never loaded. On when asked, or when no config is set. */
export const isDemo = import.meta.env.VITE_DEMO === "true" || !firebaseConfig.apiKey;
