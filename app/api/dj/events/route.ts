import { NextRequest, NextResponse } from "next/server";
import { randomInt, randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { EVENT_PROJECTION } from "@/features/dj/lib/dj-events";

const LOGO_BUCKET = "bid a beat";
const LOGO_FOLDER = "Event images";
const CODE_ATTEMPTS_PER_LEVEL = 10;
const CODE_SUFFIX_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const CODE_SKIP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "for",
  "of",
  "at",
  "&",
  "+",
  "club",
  "bar",
  "lounge",
  "cafe",
  "pub",
  "grill",
]);

function codeStem(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !CODE_SKIP_WORDS.has(w));
  const letters = words.join("").replace(/[^a-z0-9]/g, "");
  if (!letters) return "BB";
  return letters.slice(0, 4).toUpperCase().padEnd(4, "X");
}

function codeSuffix(level: number): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    if (level === 0) {
      out += String(randomInt(0, 10));
    } else {
      out += CODE_SUFFIX_CHARS[randomInt(0, CODE_SUFFIX_CHARS.length)];
    }
  }
  return out;
}

function generateCode(name: string, level: number): string {
  return `${codeStem(name)}${codeSuffix(level)}`;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "dj") {
    return NextResponse.json(
      { error: "Only DJ accounts can create events." },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const str = (key: string) => String(form.get(key) ?? "").trim();
  const name = str("name");
  const act = str("act");
  const date = str("date") || null;
  const time = str("time") || null;
  const venue = str("venue") || null;
  const pin = str("pin");
  const helperPin = str("helperPin") || null;
  const palette = str("palette") || "noir";

  if (!name) {
    return NextResponse.json(
      { error: "Please enter an event/venue name." },
      { status: 400 }
    );
  }
  if (!act) {
    return NextResponse.json(
      { error: "Please enter your act name." },
      { status: 400 }
    );
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "Please enter a 4-digit guest PIN." },
      { status: 400 }
    );
  }
  if (helperPin && !/^\d{6}$/.test(helperPin)) {
    return NextResponse.json(
      { error: "Helper PIN must be 6 digits." },
      { status: 400 }
    );
  }
  if (helperPin === pin) {
    return NextResponse.json(
      { error: "Guest PIN and Helper PIN must be different." },
      { status: 400 }
    );
  }

  const logoFile = form.get("logo");
  let logoUrl: string | null = null;
  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Logo file must be under 20MB." },
        { status: 400 }
      );
    }
    const ext =
      (logoFile.name.split(".").pop() ?? "png")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "png";
    const path = `${LOGO_FOLDER}/${user.id}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await logoFile.arrayBuffer());

    const admin = getSupabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(path, buffer, {
        contentType: logoFile.type || "application/octet-stream",
        upsert: false,
        cacheControl: "3600",
      });
    if (uploadError) {
      console.error("[create-event] logo upload failed:", uploadError);
      return NextResponse.json(
        { error: "Could not upload the logo image. Please try again." },
        { status: 500 }
      );
    }
    logoUrl = admin.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  let created: Record<string, unknown> | null = null;
  const maxAttempts = CODE_ATTEMPTS_PER_LEVEL * 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const level = Math.floor(attempt / CODE_ATTEMPTS_PER_LEVEL);
    const code = generateCode(name, level);
    const { data, error } = await supabase
      .from("events")
      .insert({
        dj_id: user.id,
        created_by: user.id,
        name,
        act,
        event_date: date,
        event_time: time ? `${time}:00` : null,
        venue,
        code,
        pin,
        helper_pin: helperPin,
        palette,
        logo_url: logoUrl,
        status: "draft",
      })
      .select(EVENT_PROJECTION)
      .single();

    if (!error) {
      created = data as Record<string, unknown>;
      break;
    }
    if (error.code !== "23505") {
      throw error;
    }
  }

  if (!created) {
    return NextResponse.json(
      { error: "Could not create the event. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, event: created });
}