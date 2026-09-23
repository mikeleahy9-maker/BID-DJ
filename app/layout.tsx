import type { Metadata, Viewport } from "next";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";

// Note: Removed validateEnv() from build time to allow Vercel deployment
// Environment variables are validated at runtime when needed

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--bebas-neue-var",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--dm-sans-var",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "BidaBeat — Bid the Beat",
    template: `%s · BidaBeat`,
  },
  description: siteConfig.description,
  keywords: ["music", "live", "requests", "bidding", "dj", "events", "nights"],
  authors: [{ name: siteConfig.author, url: siteConfig.url }],
  creator: siteConfig.creator,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: "BidaBeat — Bid the Beat",
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "BidaBeat — Bid the Beat",
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: "#080808",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen overflow-x-hidden bg-bg font-sans text-foreground"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}