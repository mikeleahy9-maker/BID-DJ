import type { DJEvent } from "@/features/dj/data";

export interface DbEventRow {
  id: string;
  dj_id: string;
  name: string;
  act: string | null;
  event_date: string | null;
  event_time: string | null;
  venue: string | null;
  code: string;
  pin: string | null;
  helper_pin: string | null;
  palette: string | null;
  logo_url: string | null;
  status: string;
  created_at: string | null;
}

export const EVENT_PROJECTION =
  "id, dj_id, name, act, event_date, event_time, venue, code, pin, helper_pin, palette, logo_url, status, created_at";

export function gigDateLabel(input: string | null | undefined): string {
  if (!input) return "TBD";
  const parsed = new Date(`${input}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "TBD";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.round(
    (target.getTime() - startOfToday.getTime()) / 86_400_000
  );

  if (diffDays === 0) return "Tonight";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= 7) {
    return target.toLocaleDateString("en-US", { weekday: "long" });
  }
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function gigTimeLabel(input: string | null | undefined): string {
  if (!input) return "TBD";
  const [hStr, mStr] = input.split(":").map(Number);
  if (Number.isNaN(hStr) || Number.isNaN(mStr)) return "TBD";
  const hour12 = hStr % 12 === 0 ? 12 : hStr % 12;
  const suffix = hStr < 12 ? "AM" : "PM";
  return mStr === 0
    ? `${hour12}:00 ${suffix}`
    : `${hour12}:${String(mStr).padStart(2, "0")} ${suffix}`;
}

export function randomPin(length: number, exclude?: string): string {
  const digits: number[] = [];
  for (let i = 0; i < length; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  if (digits[0] === 0) digits[0] = Math.floor(Math.random() * 9) + 1;
  const value = `${digits[0]}${digits.slice(1).join("")}`;
  if (exclude && value === exclude) return randomPin(length, exclude);
  return value;
}

export function dbEventToGig(row: DbEventRow): DJEvent {
  return {
    id: row.id,
    name: row.name,
    act: row.act ?? "",
    date: gigDateLabel(row.event_date),
    time: gigTimeLabel(row.event_time),
    code: row.code,
    ownerPin: row.pin ?? "",
    helperPin: row.helper_pin ?? "",
    venue: row.venue ?? undefined,
    palette: row.palette ?? "noir",
    logo: row.logo_url ?? undefined,
    status: row.status,
    seedList: [],
  };
}