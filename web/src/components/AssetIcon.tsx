import btc from "cryptocurrency-icons/svg/color/btc.svg?url";
import eth from "cryptocurrency-icons/svg/color/eth.svg?url";
import sol from "cryptocurrency-icons/svg/color/sol.svg?url";
import usdt from "cryptocurrency-icons/svg/color/usdt.svg?url";
import type { Holding } from "../data/types";

/** Coin logos (cryptocurrency-icons, CC0). Coins without one fall back to a letter. */
const LOGOS: Record<string, string> = { BTC: btc, ETH: eth, SOL: sol, USDT: usdt };

/** "BTC-EUR" → "BTC", for holdings that follow a crypto quote. */
export const assetOf = (h: Holding) => (h.tracker && /-EUR$/.test(h.tracker.symbol) ? h.tracker.symbol.replace(/-EUR$/, "") : null);

export function HoldingIcon({ holding, color }: { holding: Holding; color: string }) {
  const asset = assetOf(holding);
  const logo = asset ? LOGOS[asset] : undefined;
  if (logo) {
    return (
      <span className="avatar logo" aria-hidden>
        <img src={logo} alt="" />
      </span>
    );
  }
  return (
    <span className="avatar" style={{ ["--tone" as string]: color }} aria-hidden>
      {(asset ?? holding.name).trim().charAt(0).toUpperCase()}
    </span>
  );
}
