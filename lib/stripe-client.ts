import type { Appearance } from "@stripe/stripe-js";

/**
 * Client-safe Stripe config (publishable key + night theme appearance).
 * Safe to import from client components — only NEXT_PUBLIC values live here.
 */

export const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export const STRIPE_APPEARANCE: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#00ffe1",
    colorBackground: "#111111",
    colorText: "#f0f0f0",
    colorTextSecondary: "#666666",
    colorDanger: "#ff2d78",
    borderRadius: "8px",
    spacingUnit: "4px",
    inputColorBorder: "#2a2a2a",
    inputFocusColorBorder: "#00ffe1",
    focusBoxShadow: "0 0 0 1px #00ffe1",
  },
};