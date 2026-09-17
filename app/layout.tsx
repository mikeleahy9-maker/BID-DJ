import type { Metadata, Viewport } from "next";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { validateEnv } from "@/lib/env";

// Validate environment variables at build/startup time
validateEnv();

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
      <body className="min-h-screen overflow-x-hidden bg-bg font-sans text-foreground">
        <div className="mx-auto min-h-screen w-full max-w-[480px] bg-bg">
          {children}
        </div>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[9999] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,225,0.012)_2px,rgba(0,255,225,0.012)_4px)]"
        />
      </body>
    </html>
  );
}