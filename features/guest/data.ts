/**
 * Typed demo data for the guest dashboard (Bid-a-Beat guest screen).
 * Seeded to mirror the prototype `#screen-guest`: song catalog, request
 * queue, bought credit packs, and played history. Swap with Supabase
 * (requests/events tables) once wired — the shapes deliberately match
 * what `features/guest/components/guest-dashboard.tsx` consumes.
 */

/** A single playable track a guest can request. */
export interface SeedSong {
  id: string;
  title: string;
  artist: string;
}

/** Live queue entry — a requested song with its current bid state. */
export interface GuestQueueItem extends SeedSong {
  bidders: number;
  credits: number;
}

/** Credit pack a guest can buy with Stripe (demo pricing). */
export interface GuestCreditPack {
  id: string;
  label: string;
  credits: number;
  bonus: number;
  price: number;
  blurb: string;
  badge?: string;
}

/** Song catalog available to search & request (costs 2 credits). */
export const GUEST_SONG_CATALOG: SeedSong[] = [
  { id: "c1", title: "Blinding Lights", artist: "The Weeknd" },
  { id: "c2", title: "Heat Waves", artist: "Glass Animals" },
  { id: "c3", title: "Levitating", artist: "Dua Lipa" },
  { id: "c4", title: "As It Was", artist: "Harry Styles" },
  { id: "c5", title: "Industry Baby", artist: "Lil Nas X" },
  { id: "c6", title: "Flowers", artist: "Miley Cyrus" },
  { id: "c7", title: "Anti-Hero", artist: "Taylor Swift" },
  { id: "c8", title: "Wet Dream", artist: "Faye Webster" },
  { id: "c9", title: "Superhero", artist: "Metro Boomin" },
  { id: "c10", title: "Ruff Ryder", artist: "BidaBeat Originals" },
];

/** Demo queue — pre-seeded requests (songs already bidding). */
export const INITIAL_QUEUE: GuestQueueItem[] = [
  { id: "1", title: "Blinding Lights", artist: "The Weeknd", bidders: 8, credits: 46 },
  { id: "8", title: "Heat Waves", artist: "Glass Animals", bidders: 6, credits: 38 },
  { id: "2", title: "Levitating", artist: "Dua Lipa", bidders: 5, credits: 22 },
  { id: "13", title: "As It Was", artist: "Harry Styles", bidders: 3, credits: 14 },
  { id: "9", title: "Industry Baby", artist: "Lil Nas X", bidders: 2, credits: 9 },
];

/** Credit packs for the "Gift Credits" / buy-more flow. */
export const GUEST_PACKS: GuestCreditPack[] = [
  {
    id: "s1",
    label: "STARTER",
    credits: 20,
    bonus: 0,
    price: 20,
    blurb: "10 requests",
  },
  {
    id: "s2",
    label: "PARTY",
    credits: 55,
    bonus: 5,
    price: 50,
    blurb: "13 requests +5 bonus",
    badge: "+5 FREE",
  },
  {
    id: "s3",
    label: "VIP",
    credits: 120,
    bonus: 20,
    price: 100,
    blurb: "30 requests +20 bonus",
    badge: "BEST VALUE",
  },
];

/** Recently played / spent history for the guest (mirrors prototype GUEST_EVENT_HISTORY). */
export const GUEST_HISTORY: {
  name: string;
  dj: string;
  date: string;
  spent: number;
  songs: number;
  dot: string;
}[] = [
  { name: "The Loft", dj: "DJ Phantom", date: "May 19, 2025", spent: 18, songs: 6, dot: "#00ffe1" },
  { name: "Club Nova", dj: "DJ Solaris", date: "May 10, 2025", spent: 32, songs: 11, dot: "#ff6600" },
  { name: "Rooftop Bar", dj: "DJ Phantom", date: "Apr 28, 2025", spent: 24, songs: 8, dot: "#cc66ff" },
];

/** Dollar value of a single credit (1 credit = $1). */
export const CREDIT_VALUE = 1;
