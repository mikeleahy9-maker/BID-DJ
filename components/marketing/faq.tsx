/**
 * Public FAQ accordion.
 * Uses native <details>/<summary> for full keyboard + screen-reader
 * support with no client JavaScript. Answers stay within the product's
 * actual behaviour (credits, bidding, queues, payouts).
 */

interface FaqItem {
  q: string;
  a: string;
}

const faqs: FaqItem[] = [
  {
    q: "What is BidaBeat?",
    a: "BidaBeat is a crowd-funded jukebox for live events. Guests request songs and bid to move them up the queue, while DJs and bands run the night from a live request queue — so the crowd helps shape the soundtrack in real time.",
  },
  {
    q: "How do guest credits work?",
    a: "Guests purchase credits, which are $1.00 each plus any bonus credits on larger packs, processed securely through Stripe. Credits are spent to request songs and bid them up the queue. Any credits still unused when the event ends are automatically donated to the event organizer and are not refunded.",
  },
  {
    q: "How can guests participate in music requests and voting?",
    a: "Join an event using the code or QR shared by the DJ, buy credits, then request songs and bid to push your favourites up the live queue. The higher a song is bid, the higher it climbs — and if a song you bid on is refunded or removed by the DJ, those credits return to your balance.",
  },
  {
    q: "How do DJs and bands use BidaBeat?",
    a: "DJs and bands create and manage events, share an event code or QR with the crowd, and run the live queue — approving, reordering, skipping or playing requests. You also engage guests directly and track your earnings and payouts from the dashboard.",
  },
  {
    q: "How can a DJ receive payouts?",
    a: "DJs connect a Stripe Express account before payouts are enabled. After an event ends, payouts are handled automatically via Stripe and typically arrive 7–8 business days later.",
  },
  {
    q: "Are events public?",
    a: "No. Each event is private and has its own code or QR. Only guests with that code can join, request songs and bid — your event and its queue stay between you and your crowd.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-edge/60">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[3px] text-neon">
            FAQ
          </p>
          <h2 className="mt-3 font-display text-[36px] tracking-[2px] text-foreground sm:text-[44px]">
            Questions, answered
          </h2>
        </div>

        <div className="mt-10 divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-surface/50">
          {faqs.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-foreground transition-colors hover:text-neon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden
                  className="shrink-0 text-lg leading-none text-neon transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-[1.7] text-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Faq;
