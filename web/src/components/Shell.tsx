import { Notebook, PersonSimpleRun, Plus, Wallet, type Icon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject } from "react";
import { useData } from "../data/context";
import { formatToday } from "../lib/format";
import { Finance } from "../tabs/Finance";
import { Sport } from "../tabs/Sport";
import { Thoughts } from "../tabs/Thoughts";
import { CaptureSheet } from "./CaptureSheet";
import { SkeletonPage } from "./Skeleton";

interface Tab {
  id: "sport" | "pensees" | "finance";
  label: string;
  icon: Icon;
  View: ComponentType;
}

const TABS: Tab[] = [
  { id: "sport", label: "Sport", icon: PersonSimpleRun, View: Sport },
  { id: "pensees", label: "Pensées", icon: Notebook, View: Thoughts },
  { id: "finance", label: "Finance", icon: Wallet, View: Finance },
];
type TabId = Tab["id"];

/** The tab lives in the URL hash, so a home-screen shortcut can open /#finance directly. */
function useHashTab(): [TabId, (id: TabId) => void] {
  const read = () => TABS.find((t) => `#${t.id}` === window.location.hash)?.id ?? "sport";
  const [tab, setTab] = useState<TabId>(read);
  useEffect(() => {
    const onHash = () => setTab(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return [
    tab,
    (id) => {
      if (id === tab) {
        window.scrollTo({ top: 0, behavior: "smooth" }); // tapping the current tab scrolls up, as on iOS
        return;
      }
      window.location.hash = id;
      window.scrollTo({ top: 0 });
    },
  ];
}

/** True once the large title has scrolled under the navigation bar. */
function useCollapsed(target: RefObject<HTMLElement | null>, page: string) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!target.current) return;
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      rootMargin: "-52px 0px 0px 0px",
    });
    observer.observe(target.current);
    return () => observer.disconnect();
  }, [target, page]); // re-observe when the page (and its title) changes
  return collapsed;
}

export function Shell({ demo, accountAction }: { demo: boolean; accountAction?: ReactNode }) {
  const { loading } = useData();
  const [tab, setTab] = useHashTab();
  const [captureOpen, setCaptureOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const collapsed = useCollapsed(titleRef, tab);
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div data-section={tab}>
      <header className="navbar" data-collapsed={collapsed}>
        <span className="navbar-title">{current.label}</span>
      </header>

      <main className="page">
        <div className="large-title">
          <p className="date">{formatToday()}</p>
          <h1 ref={titleRef}>
            {current.label}
            {demo && <span className="badge">Démo</span>}
          </h1>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={loading ? "loading" : tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {loading ? <SkeletonPage /> : <current.View />}
          </motion.div>
        </AnimatePresence>

        {accountAction}
      </main>

      <nav className="dock" aria-label="Sections">
        <div className="tabbar glass">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button key={t.id} className="tab" aria-current={active ? "page" : undefined} onClick={() => setTab(t.id)}>
                {active && (
                  <motion.span
                    layoutId="tab-highlight"
                    className="tab-highlight"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                  />
                )}
                <t.icon size={26} weight={active ? "fill" : "regular"} aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>
        <button className="capture-button glass" aria-label="Ajouter un rêve, une note ou une dépense" onClick={() => setCaptureOpen(true)}>
          <Plus size={26} weight="bold" aria-hidden />
        </button>
      </nav>

      <CaptureSheet open={captureOpen} onOpenChange={setCaptureOpen} initialKind={tab === "finance" ? "expense" : "dream"} />
    </div>
  );
}
