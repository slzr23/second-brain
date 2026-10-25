import { GoogleLogo } from "@phosphor-icons/react";
import { FirebaseError } from "firebase/app";
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { FirestoreDataProvider } from "./data/FirestoreDataProvider";
import { auth } from "./lib/firebase";
import { isoWeekId } from "./lib/week";

/** What to do about each sign-in failure, with the Firebase code kept visible for debugging. */
const SIGN_IN_ERRORS: Record<string, string> = {
  "auth/operation-not-allowed": "La connexion Google n'est pas activée. Console Firebase > Authentication > Sign-in method > Google.",
  "auth/configuration-not-found": "Authentication n'est pas initialisé. Console Firebase > Authentication > Commencer, puis active Google.",
  "auth/unauthorized-domain": "Ce domaine n'est pas autorisé. Console Firebase > Authentication > Settings > Authorized domains.",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "La clé API est invalide. Vérifie VITE_FIREBASE_API_KEY dans web/.env.local, puis redéploie.",
  "auth/invalid-api-key": "La clé API est invalide. Vérifie VITE_FIREBASE_API_KEY dans web/.env.local, puis redéploie.",
  "auth/network-request-failed": "Pas de connexion au réseau. Réessaie dans un instant.",
};
const IGNORED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

function describe(error: unknown): string | null {
  const code = error instanceof FirebaseError ? error.code : "inconnu";
  if (IGNORED.has(code)) return null;
  return `${SIGN_IN_ERRORS[code] ?? "La connexion n'a pas abouti."} (${code})`;
}

function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const provider = new GoogleAuthProvider();

  // Errors from a redirect sign-in come back on the next page load.
  useEffect(() => {
    getRedirectResult(auth).catch((e) => setError(describe(e)));
  }, []);

  const signIn = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      // Pop-ups blocked (or unsupported, as in some installed iPhone apps): fall back to a full-page redirect.
      if (e instanceof FirebaseError && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
        await signInWithRedirect(auth, provider);
        return;
      }
      console.error(e);
      setError(describe(e));
    }
  };

  return (
    <div className="signin">
      <div className="signin-mark">
        <img src={`${import.meta.env.BASE_URL}icon-512.png`} alt="" />
        <h1>Second cerveau</h1>
        <p>Tes sorties, tes pensées et tes dépenses, au même endroit.</p>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="primary" onClick={signIn}>
        <GoogleLogo size={20} weight="bold" aria-hidden />
        Continuer avec Google
      </button>
    </div>
  );
}

const signOutButton = (
  <p style={{ textAlign: "center", marginTop: 32 }}>
    <button className="secondary" style={{ fontSize: 15 }} onClick={() => signOut(auth)}>
      Se déconnecter
    </button>
  </p>
);

/** The signed-in app: Google sign-in, then live Firestore data. Loaded lazily. */
export default function RealApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <div className="signin" aria-busy="true" />;
  if (!user) return <SignIn />;
  return (
    <FirestoreDataProvider uid={user.uid} weekId={isoWeekId()}>
      <Shell demo={false} accountAction={signOutButton} />
    </FirestoreDataProvider>
  );
}
