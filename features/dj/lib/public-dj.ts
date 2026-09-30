/**
 * Shared types + helpers for the public DJ profile page.
 *
 * Kept out of the route file so both the page and the presentational
 * component can import them without one importing the other.
 */

export interface PublicEvent {
  id: string;
  name: string | null;
  act: string | null;
  event_date: string | null;
  event_time: string | null;
  venue: string | null;
  city: string | null;
  palette: string | null;
  status: string | null;
}

export interface PublicDjData {
  slug: string;
  actName: string;
  description: string | null;
  city: string | null;
  tags: string[];
  avatarUrl: string | null;
  memberSince: string | null;
  events: PublicEvent[];
}
