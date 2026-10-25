import { createContext, useContext, useEffect, useState } from "react";

export const TAB_IDS = ["sport", "pensees", "finance"] as const;
export type TabId = (typeof TAB_IDS)[number];

/** "#finance/compte/Livret%20A" → { tab: "finance", path: ["compte", "Livret A"] } */
export interface Route {
  tab: TabId;
  path: string[];
}

export function parseHash(hash: string): Route {
  const [first, ...rest] = hash.replace(/^#/, "").split("/").filter(Boolean);
  const tab = (TAB_IDS as readonly string[]).includes(first) ? (first as TabId) : "sport";
  return { tab, path: tab === first ? rest.map(decodeURIComponent) : [] };
}

export const formatHash = ({ tab, path }: Route) => `#${[tab, ...path.map(encodeURIComponent)].join("/")}`;

/** The route lives in the URL hash, so a home-screen shortcut can open /#finance/depenses directly. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = (next: Route) => {
    const hash = formatHash(next);
    if (hash === window.location.hash) {
      window.scrollTo({ top: 0, behavior: "smooth" }); // tapping where you already are scrolls up, as on iOS
      return;
    }
    window.location.hash = hash;
    window.scrollTo({ top: 0 });
  };
  return [route, navigate];
}

export const RouteContext = createContext<{ route: Route; navigate: (route: Route) => void } | null>(null);

export function useRoute() {
  const value = useContext(RouteContext);
  if (!value) throw new Error("useRoute must be used inside the shell");
  return value;
}
