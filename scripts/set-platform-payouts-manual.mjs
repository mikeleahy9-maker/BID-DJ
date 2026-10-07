#!/usr/bin/env node
/**
 * Switch BidaBeat's own (platform) Stripe account to MANUAL payouts.
 *
 * Why: settlement transfers draw from our *available* balance. With the default
 * automatic payout schedule, Stripe sweeps that balance to our bank every day,
 * racing the transfers we owe the organizer and the DJ. A share released because
 * its charge finally settled could be paid out to us before it is paid out to
 * them, and the transfer would fail again.
 *
 * With manual payouts the balance sits where the transfers need it. The
 * platform's own 10% is then paid out by a human from the Stripe dashboard
 * whenever convenient -- it is not on anyone's critical path.
 *
 * Usage:
 *   node scripts/set-platform-payouts-manual.mjs           # switch to manual
 *   node scripts/set-platform-payouts-manual.mjs --undo     # back to daily
 *
 * Reads STRIPE_SECRET_KEY from the environment, falling back to .env.local /
 * .env.development. The key is never printed.
 *
 * NOTE: Stripe only allows updating the platform account's payout schedule
 * with a live key ("Only live keys can access this method" in test mode). When
 * that happens this script prints the dashboard path instead of failing
 * silently -- the setting is safe to change by hand.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name) {
  const path = resolve(root, name);
  try {
    const out = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1) continue;
      const key = line.slice(0, i).trim();
      if (key in process.env) continue; // real env always wins
      out[key] = line.slice(i + 1).trim();
    }
    return out;
  } catch {
    return {};
  }
}

const env = {
  ...loadEnvFile(".env.development"),
  ...loadEnvFile(".env.local"),
  ...process.env,
};

const key = env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set. Add it to .env.development.");
  process.exit(1);
}

const { default: Stripe } = await import("stripe");
const stripe = new Stripe(key);

const undo = process.argv.includes("--undo");
const interval = undo ? "daily" : "manual";

const account = await stripe.accounts.retrieve();

const schedule = account.settings?.payouts?.schedule;
const current = schedule?.interval ?? "automatic";
const type = schedule?.interval === "manual" ? "manual" : (schedule?.interval ?? "daily");

console.log(`account:      ${account.id}`);
console.log(`payouts on:   ${account.payouts_enabled}`);
console.log(`currently:    interval=${current}${type ? ` (${type})` : ""}`);

if (current === interval) {
  console.log(`Already ${interval}. Nothing to do.`);
  process.exit(0);
}

await stripe.accounts.update(account.id, {
  settings: { payouts: { schedule: { interval } } },
});

try {
  await stripe.accounts.update(account.id, {
    settings: { payouts: { schedule: { interval } } },
  });
} catch (err) {
  // Stripe refuses to change the platform account's payout schedule with a
  // restricted/test key. The setting itself is fine to change by hand.
  if (/Only live keys can access this method/i.test(err?.message ?? "")) {
    console.log("");
    console.error("Stripe only allows this change with a live key.");
    console.error("Set it by hand instead:");
    console.error(`  ${undo ? "Settings > Payouts > Schedule > Automatic" : "Settings > Payouts > Schedule > Manual"}`);
    console.error(`  https://dashboard.stripe.com/${undo ? "test/" : ""}settings/payouts`);
    process.exit(1);
  }
  throw err;
}

const updated = await stripe.accounts.retrieve();
console.log(
  `updated:      interval=${updated.settings?.payouts?.schedule?.interval ?? "unknown"}`
);
console.log(
  interval === "manual"
    ? "Platform balance will now accumulate until paid out manually from the dashboard."
    : "Platform balance will again be swept to the bank automatically (daily)."
);