/**
 * Site-wide configuration for BidaBeat.
 * Contains application metadata, navigation, and static settings.
 */

export const siteConfig = {
  name: "BidaBeat",
  description: "The platform for live music requests and tipping",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",

  // Metadata
  author: "BidaBeat",
  creator: "BidaBeat",

  // Navigation structure for marketing/landing pages
  marketing: {
    nav: [
      {
        title: "Home",
        href: "/",
      },
      {
        title: "Features",
        href: "/#features",
      },
      {
        title: "Pricing",
        href: "/#pricing",
      },
    ],
  },

  // Guest navigation
  guest: {
    nav: [
      {
        title: "Dashboard",
        href: "/dashboard",
      },
      {
        title: "Events",
        href: "/events",
      },
    ],
  },

  // DJ navigation
  dj: {
    nav: [
      {
        title: "Dashboard",
        href: "/dj/dashboard",
      },
      {
        title: "Events",
        href: "/dj/events",
      },
      {
        title: "Queue",
        href: "/dj/queue",
      },
      {
        title: "Earnings",
        href: "/dj/earnings",
      },
    ],
  },

  // Links
  links: {
    twitter: "#",
    github: "#",
    docs: "#",
    contact: "support@bidabeat.com",
  },

  // Application roles
  roles: {
    guest: "Guest",
    dj_owner: "DJ Owner",
    dj_helper: "DJ Helper",
  },
} as const;

// Type-safe site configuration
export type SiteConfig = typeof siteConfig;
