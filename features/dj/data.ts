/**
 * Typed demo data for the DJ dashboard.
 * Mirrors the prototype (bidabeat_8 (2).html). Swap for Supabase queries later.
 */

export interface SeedSong {
  id: string;
  title: string;
  artist: string;
  credits: number;
  deezerId?: number | null;
  image?: string | null;
  durationSec?: number | null;
}

export interface EventPalette {
  id: string;
  name: string;
  bg: string;
  neon: string;
  dot: string;
}

export interface DJEvent {
  id: string;
  name: string;
  act: string;
  date: string;
  time: string;
  code: string;
  ownerPin: string;
  helperPin: string;
  venue?: string;
  palette?: string;
  logo?: string;
  status?: string;
  seedList: SeedSong[];
}

export interface QueueItem extends SeedSong {
  bidders: number;
  seeded?: boolean;
}

export interface PastEvent {
  name: string;
  date: string;
  earned: number;
  songs: number;
}

export interface SavedPlaylist {
  id: string;
  name: string;
  icon: string;
  songs: SeedSong[];
}

export interface EarningsPeriodData {
  total: number;
  gigs: number;
  songs: number;
  guests: number;
  events: { name: string; date: string; earned: number; songs: number }[];
}

export const DJ_OWNER = {
  name: "DJ Phantom",
  handle: "bidabeat.app/phantom",
  avatar: "🎛️",
};

/** Event color palettes — mirrors the prototype's "Event Feel" picker. */
export const EVENT_PALETTES: EventPalette[] = [
  { id: "noir", name: "Noir", bg: "#080808", neon: "#00ffe1", dot: "#00ffe1" },
  { id: "inferno", name: "Inferno", bg: "#0a0400", neon: "#ff6600", dot: "#ff6600" },
  { id: "velvet", name: "Velvet", bg: "#0a0010", neon: "#cc66ff", dot: "#cc66ff" },
  { id: "ocean", name: "Ocean", bg: "#000a12", neon: "#00d4ff", dot: "#00d4ff" },
  { id: "jungle", name: "Jungle", bg: "#020a00", neon: "#44ff44", dot: "#44ff44" },
  { id: "arctic", name: "Arctic", bg: "#010810", neon: "#aaddff", dot: "#aaddff" },
  { id: "blush", name: "Blush", bg: "#0d0006", neon: "#ff66aa", dot: "#ff66aa" },
  { id: "electric", name: "Electric", bg: "#050510", neon: "#ffff00", dot: "#ffff00" },
];

export const DJ_EVENTS: DJEvent[] = [
  {
    id: "ev1",
    name: "The Loft",
    act: "DJ Phantom",
    date: "Tonight",
    time: "9:00 PM",
    code: "LOFT22",
    ownerPin: "5678",
    helperPin: "9999",
    seedList: [
      { id: "1", title: "Blinding Lights", artist: "The Weeknd", credits: 10 },
      { id: "8", title: "Heat Waves", artist: "Glass Animals", credits: 5 },
    ],
  },
  {
    id: "ev2",
    name: "Club Nova",
    act: "DJ Phantom",
    date: "Friday",
    time: "10:00 PM",
    code: "NOVA99",
    ownerPin: "5678",
    helperPin: "4321",
    seedList: [],
  },
  {
    id: "ev3",
    name: "Rooftop Bar",
    act: "DJ Phantom",
    date: "Saturday",
    time: "8:00 PM",
    code: "ROOF44",
    ownerPin: "5678",
    helperPin: "7777",
    seedList: [],
  },
];

export const PAST_EVENTS: PastEvent[] = [
  { name: "Private Event", date: "May 6", earned: 520.5, songs: 32 },
  { name: "Club Nova", date: "May 2", earned: 235.0, songs: 16 },
  { name: "The Loft", date: "Apr 28", earned: 412.0, songs: 28 },
];

export const SAVED_PLAYLISTS: SavedPlaylist[] = [
  {
    id: "pl1",
    name: "Club Bangers",
    icon: "🔥",
    songs: [
      { id: "1", title: "Blinding Lights", artist: "The Weeknd", credits: 10 },
      { id: "2", title: "Levitating", artist: "Dua Lipa", credits: 8 },
      { id: "5", title: "Good 4 U", artist: "Olivia Rodrigo", credits: 6 },
    ],
  },
  {
    id: "pl2",
    name: "Chill Vibes",
    icon: "🌊",
    songs: [
      { id: "8", title: "Heat Waves", artist: "Glass Animals", credits: 5 },
      { id: "13", title: "As It Was", artist: "Harry Styles", credits: 5 },
    ],
  },
  {
    id: "pl3",
    name: "Party Starters",
    icon: "🎉",
    songs: [
      { id: "7", title: "Montero", artist: "Lil Nas X", credits: 12 },
      { id: "9", title: "Industry Baby", artist: "Lil Nas X", credits: 8 },
    ],
  },
];

export const SONG_CATALOG: SeedSong[] = [
  { id: "1", title: "Blinding Lights", artist: "The Weeknd", credits: 0 },
  { id: "2", title: "Levitating", artist: "Dua Lipa", credits: 0 },
  { id: "3", title: "Save Your Tears", artist: "The Weeknd", credits: 0 },
  { id: "4", title: "Stay", artist: "The Kid LAROI", credits: 0 },
  { id: "5", title: "Good 4 U", artist: "Olivia Rodrigo", credits: 0 },
  { id: "6", title: "Peaches", artist: "Justin Bieber", credits: 0 },
  { id: "7", title: "Montero", artist: "Lil Nas X", credits: 0 },
  { id: "8", title: "Heat Waves", artist: "Glass Animals", credits: 0 },
  { id: "9", title: "Industry Baby", artist: "Lil Nas X", credits: 0 },
  { id: "10", title: "Bad Habits", artist: "Ed Sheeran", credits: 0 },
  { id: "11", title: "Shivers", artist: "Ed Sheeran", credits: 0 },
  { id: "12", title: "Easy On Me", artist: "Adele", credits: 0 },
  { id: "13", title: "As It Was", artist: "Harry Styles", credits: 0 },
  { id: "14", title: "Fancy Like", artist: "Walker Hayes", credits: 0 },
];

export const INITIAL_QUEUE: QueueItem[] = [
  { id: "1", title: "Blinding Lights", artist: "The Weeknd", credits: 42, bidders: 7 },
  { id: "8", title: "Heat Waves", artist: "Glass Animals", credits: 31, bidders: 5 },
  { id: "2", title: "Levitating", artist: "Dua Lipa", credits: 24, bidders: 4 },
  { id: "5", title: "Good 4 U", artist: "Olivia Rodrigo", credits: 18, bidders: 3 },
  { id: "10", title: "Bad Habits", artist: "Ed Sheeran", credits: 9, bidders: 2 },
];

export const PENDING_REQUESTS: { id: string; title: string; artist: string }[] =
  [
    { id: "p1", title: "Something About You", artist: "Boston Bun" },
    { id: "p2", title: "Never Going Home", artist: "Hazel" },
  ];

export const GUEST_SPENDING: Record<string, number> = {
  Alex: 28,
  Jamie: 22,
  Sam: 18,
  Taylor: 13,
  Morgan: 9,
};

export const EARNINGS_HISTORY: Record<string, EarningsPeriodData> = {
  week: {
    total: 847.5,
    gigs: 3,
    songs: 54,
    guests: 121,
    events: [
      { name: "The Loft", date: "May 19", earned: 412.0, songs: 28 },
      { name: "Club Nova", date: "May 16", earned: 235.5, songs: 16 },
      { name: "Rooftop Bar", date: "May 14", earned: 200.0, songs: 10 },
    ],
  },
  month: {
    total: 2340.0,
    gigs: 9,
    songs: 142,
    guests: 318,
    events: [
      { name: "The Loft", date: "May 19", earned: 412.0, songs: 28 },
      { name: "Club Nova", date: "May 16", earned: 235.5, songs: 16 },
      { name: "Rooftop Bar", date: "May 14", earned: 200.0, songs: 10 },
      { name: "The Loft", date: "May 10", earned: 380.0, songs: 24 },
      { name: "Private Event", date: "May 6", earned: 520.5, songs: 32 },
      { name: "Club Nova", date: "May 2", earned: 592.0, songs: 32 },
    ],
  },
  year: {
    total: 18420.0,
    gigs: 74,
    songs: 1180,
    guests: 2640,
    events: [
      { name: "The Loft", date: "May 19", earned: 412.0, songs: 28 },
      { name: "Club Nova", date: "May 16", earned: 235.5, songs: 16 },
      { name: "Rooftop Bar", date: "May 14", earned: 200.0, songs: 10 },
      { name: "Private Event", date: "Apr 30", earned: 880.0, songs: 56 },
      { name: "Club Nova", date: "Apr 22", earned: 650.0, songs: 40 },
    ],
  },
  all: {
    total: 41860.0,
    gigs: 183,
    songs: 2940,
    guests: 6540,
    events: [
      { name: "The Loft", date: "May 19", earned: 412.0, songs: 28 },
      { name: "Club Nova", date: "May 16", earned: 235.5, songs: 16 },
      { name: "Rooftop Bar", date: "May 14", earned: 200.0, songs: 10 },
      { name: "Private Event", date: "Apr 30", earned: 880.0, songs: 56 },
      { name: "Club Nova", date: "Apr 22", earned: 650.0, songs: 40 },
    ],
  },
};

export const REFUND_REASONS = [
  { icon: "✅", label: "Already played it" },
  { icon: "🚫", label: "Too offensive / not appropriate" },
  { icon: "🙅", label: "Asked not to play that" },
  { icon: "💿", label: "Don't have it" },
  { icon: "🔌", label: "Can't get it / not available" },
];

/** Revenue split constants (BidaBeat manages payouts via Stripe Connect). */
export const REVENUE_SPLIT = {
  organizer: 0.7,
  dj: 0.2,
  bidabeat: 0.1,
  creditValue: 1.0,
} as const;

export const PRICING = {
  CREDIT_VALUE: 1.0,
  BIDABEAT_PCT: 0.1,
  DJ_PCT: 0.2,
  ORGANIZER_PCT: 0.7,
} as const;