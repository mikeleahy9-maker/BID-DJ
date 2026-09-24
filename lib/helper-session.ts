import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const HELPER_COOKIE = "bidabeat_helper";
const HELPER_MAX_AGE = 12 * 60 * 60;

export interface HelperSession {
  eventId: string;
  djId: string;
  code: string;
  name: string;
  exp: number;
}

function secret(): string {
  const s = process.env.SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SESSION_SECRET is not set.");
  return s;
}

function signPayload(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createHelperCookie(data: {
  eventId: string;
  djId: string;
  code: string;
  name: string;
}): string {
  const session: HelperSession = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + HELPER_MAX_AGE,
  };
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `v1.${payload}.${signPayload(payload)}`;
}

export async function readHelperSession(): Promise<HelperSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(HELPER_COOKIE)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;

  const [, payload, sig] = parts;
  const expected = signPayload(payload);
  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let parsed: HelperSession;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!parsed?.eventId || !parsed?.code || parsed.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return parsed;
}