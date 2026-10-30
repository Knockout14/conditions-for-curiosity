import { removeOldCounters } from "./_lib/rate-limit.mjs";
import { errorMessage } from "./_lib/input.mjs";

// Runs once a day and deletes rate-limit counters from earlier days, so they
// don't pile up. It has no web address: only Netlify's scheduler calls it.
export default async () => {
  try {
    console.log(`cleanup-rate-limits: removed ${await removeOldCounters()}`);
  } catch (e) {
    console.error(`cleanup-rate-limits: ${errorMessage(e)}`);
  }
};

export const config = { schedule: "@daily" };
