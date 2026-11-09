import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/options";

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 3 });

export { ingest } from "./ingest";
export { refreshPrices } from "./prices";
export { bankCallback, bankConnect, bankSync, bankSyncNow } from "./bank";

// Next steps of the MVP (see README > Roadmap):
// export { stravaWebhook } from "./sport/stravaWebhook";
// export { applyProposal } from "./sport/applyProposal";
// export { weeklyDreamReport } from "./thoughts/weeklyDreamReport";
