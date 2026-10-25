import { Account } from "./finance/Account";
import { Overview } from "./finance/Overview";
import { Spending } from "./finance/Spending";

/**
 * Finance is a small stack of pages, iOS-style:
 *   #finance                  → Overview (wealth, accounts, spending preview)
 *   #finance/depenses         → Spending
 *   #finance/compte/<account> → one account
 */
export function Finance({ path }: { path: string[] }) {
  if (path[0] === "depenses") return <Spending />;
  if (path[0] === "compte" && path[1]) return <Account name={path[1]} />;
  return <Overview />;
}

export function financeTitle(path: string[]): string | null {
  if (path[0] === "depenses") return "Dépenses";
  if (path[0] === "compte" && path[1]) return path[1];
  return null;
}
