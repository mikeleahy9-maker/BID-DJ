import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { siteConfig } from "@/config/site";

const { product, legal } = siteConfig.marketing.footer;

interface FooterColumnProps {
  title: string;
  links: ReadonlyArray<{ title: string; href: string }>;
}

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[2px] text-muted">
        {title}
      </h3>
      <ul className="space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="rounded text-muted transition-colors hover:text-neon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Public marketing footer — product, legal and contact links.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-edge bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo size="sm" />
            <p className="mt-4 max-w-xs text-sm leading-[1.7] text-muted">
              Bid the Beat. Own the Night. A crowd-funded jukebox for live
              events — guests request songs and bid them up the queue.
            </p>
          </div>

          <FooterColumn title="Product" links={product} />
          <FooterColumn title="Legal" links={legal} />

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[2px] text-muted">
              Contact
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={`mailto:${siteConfig.links.contact}`}
                  className="rounded text-muted transition-colors hover:text-neon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  {siteConfig.links.contact}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-edge pt-6 text-xs text-muted sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights
            reserved.
          </p>
          <p>Made for live music.</p>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
