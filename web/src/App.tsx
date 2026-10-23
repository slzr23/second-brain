import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { DemoDataProvider, FirestoreDataProvider } from "./data/DataProvider";
import { auth, isDemo } from "./lib/firebase";
import { formatToday } from "./lib/format";
import { isoWeekId } from "./lib/week";
import { Finance } from "./tabs/Finance";
import { Sport } from "./tabs/Sport";
import { Thoughts } from "./tabs/Thoughts";

const TABS = [
  { id: "sport", label: "Sport", View: Sport },
  { id: "pensees", label: "Pensées", View: Thoughts },
  { id: "finance", label: "Finance", View: Finance },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** The tab lives in the URL hash, so a home-screen shortcut can open /#finance directly. */
function useHashTab(): [TabId, (id: TabId) => void] {
  const read = () => (TABS.find((t) => `#${t.id}` === window.location.hash)?.id ?? "sport") as TabId;
  const [tab, setTab] = useState<TabId>(read);
  useEffect(() => {
    const onHash = () => setTab(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return [tab, (id) => (window.location.hash = id)];
}

function Shell({ user }: { user: User | null }) {
  const [tab, setTab] = useHashTab();
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="shell" data-section={tab}>
      <header className="masthead">
        <div className="masthead-inner">
          <p className="today">{formatToday()}</p>
          <h1>{current.label}</h1>
          {isDemo ? (
            <p className="mode">Démo avec des données fictives</p>
          ) : (
            user && (
              <button className="link" onClick={() => auth && signOut(auth)}>
                Se déconnecter
              </button>
            )
          )}
        </div>
      </header>

      <main className="content">
        <current.View />
      </main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="tab"
            data-tab={t.id}
            aria-current={t.id === tab ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-dot" aria-hidden />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const signIn = () =>
    signInWithPopup(auth!, new GoogleAuthProvider()).catch(() =>
      setError("La connexion n'a pas abouti. Autorise les pop-ups pour ce site, puis réessaie."),
    );

  return (
    <div className="signin">
      <h1>Second cerveau</h1>
      <p>Tes sorties, tes pensées et tes dépenses, au même endroit.</p>
      <button className="primary" onClick={signIn}>
        Se connecter avec Google
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(isDemo ? null : undefined);

  useEffect(() => (auth ? onAuthStateChanged(auth, setUser) : undefined), []);

  if (isDemo) {
    return (
      <DemoDataProvider>
        <Shell user={null} />
      </DemoDataProvider>
    );
  }
  if (user === undefined) return <div className="signin" aria-busy="true" />;
  if (!user) return <SignIn />;

  return (
    <FirestoreDataProvider uid={user.uid} weekId={isoWeekId()}>
      <Shell user={user} />
    </FirestoreDataProvider>
  );
}
