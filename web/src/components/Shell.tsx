import { CaretLeft, Notebook, PersonSimpleRun, Plus, Wallet, type Icon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject } from "react";
import { useData } from "../data/context";
import { formatToday } from "../lib/format";
import { RouteContext, useHashRoute, type TabId } from "../lib/route";
import { Finance, financeTitle } from "../tabs/Finance";
import { Sport } from "../tabs/Sport";
import { Thoughts } from "../tabs/Thoughts";
import { CaptureSheet } from "./CaptureSheet";
import { ImportSheet } from "./ImportSheet";
import { SkeletonPage } from "./Skeleton";

interface Tab {
  id: TabId;
  label: string;
  icon: Icon;
  View: ComponentType<{ path: string[] }>;
  /** Title of a sub-page ("Dépenses"), null for the tab's main page. */
  title?: (path: string[]) => string | null;
}

const TABS: Tab[] = [
  { id: "sport", label: "Sport", icon: PersonSimpleRun, View: Sport },
  { id: "pensees", label: "Pensées", icon: Notebook, View: Thoughts },
  { id: "finance", label: "Finance", icon: Wallet, View: Finance, title: financeTitle },
];

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
  const [route, navigate] = useHashRoute();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pageKey = [route.tab, ...route.path].join("/");
  const collapsed = useCollapsed(titleRef, pageKey);
  const current = TABS.find((t) => t.id === route.tab)!;
  const subTitle = route.path.length ? (current.title?.(route.path) ?? null) : null;
  const title = subTitle ?? current.label;

  return (
    <RouteContext.Provider value={{ route, navigate }}>
      <div data-section={route.tab}>
        <header className="navbar" data-collapsed={collapsed}>
          {subTitle && (
            <button className="nav-back" onClick={() => navigate({ tab: route.tab, path: route.path.slice(0, -2) })}>
              <CaretLeft size={22} weight="bold" aria-hidden />
              {current.label}
            </button>
          )}
          <span className="navbar-title">{title}</span>
        </header>

        <main className="page">
          <div className="large-title">
            {!subTitle && <p className="date">{formatToday()}</p>}
            <h1 ref={titleRef}>
              {title}
              {demo && !subTitle && <span className="badge">Démo</span>}
            </h1>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={loading ? "loading" : pageKey}
              initial={{ opacity: 0, x: subTitle ? 16 : 0, y: subTitle ? 0 : 6 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {loading ? <SkeletonPage /> : <current.View path={route.path} />}
            </motion.div>
          </AnimatePresence>

          {!subTitle && accountAction}
        </main>

        <nav className="dock" aria-label="Sections">
          <div className="tabbar glass">
            {TABS.map((t) => {
              const active = t.id === route.tab;
              return (
                <button key={t.id} className="tab" aria-current={active ? "page" : undefined} onClick={() => navigate({ tab: t.id, path: [] })}>
                  {active && (
                    <motion.span layoutId="tab-highlight" className="tab-highlight" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />
                  )}
                  <t.icon size={26} weight={active ? "fill" : "regular"} aria-hidden />
                  {t.label}
                </button>
              );
            })}
          </div>
          <button className="capture-button glass" aria-label="Ajouter : rêve, note, dépense, entrée d'argent ou import" onClick={() => setCaptureOpen(true)}>
            <Plus size={26} weight="bold" aria-hidden />
          </button>
        </nav>

        <CaptureSheet
          open={captureOpen}
          onOpenChange={setCaptureOpen}
          onImport={() => {
            setCaptureOpen(false);
            // Let the first sheet slide away before the next one comes up.
            setTimeout(() => setImportOpen(true), 350);
          }}
        />
        <ImportSheet open={importOpen} onOpenChange={setImportOpen} />
      </div>
    </RouteContext.Provider>
  );
}
