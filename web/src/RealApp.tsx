import { GoogleLogo } from "@phosphor-icons/react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { FirestoreDataProvider } from "./data/FirestoreDataProvider";
import { auth } from "./lib/firebase";
import { isoWeekId } from "./lib/week";

function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const signIn = () =>
    signInWithPopup(auth, new GoogleAuthProvider()).catch(() =>
      setError("La connexion n'a pas abouti. Autorise les pop-ups pour ce site, puis réessaie."),
    );

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
