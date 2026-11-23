import { Account } from "./finance/Account";
import { Category, categoryTitle } from "./finance/Category";
import { Current } from "./finance/Current";
import { Overview } from "./finance/Overview";
import { Spending } from "./finance/Spending";

/**
 * Finance is two parts and a small stack of pages, iOS-style:
 *   #finance                  → Compte courant (this month, from one salary to the next)
 *   #finance/patrimoine       → Patrimoine (savings and investments)
 *   #finance/categorie/<id>   → one spending category this month
 *   #finance/depenses         → spending over time
 *   #finance/compte/<account> → one account
 */
export function Finance({ path }: { path: string[] }) {
  if (path[0] === "patrimoine") return <Overview />;
  if (path[0] === "categorie" && path[1]) return <Category id={path[1]} />;
  if (path[0] === "depenses") return <Spending />;
  if (path[0] === "compte" && path[1]) return <Account name={path[1]} />;
  return <Current />;
}

export function financeTitle(path: string[]): string | null {
  if (path[0] === "categorie" && path[1]) return categoryTitle(path[1]);
  if (path[0] === "depenses") return "Dans le temps";
  if (path[0] === "compte" && path[1]) return path[1];
  return null;
}
