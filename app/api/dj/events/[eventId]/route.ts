import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { EVENT_PROJECTION } from "@/features/dj/lib/dj-events";

const LOGO_BUCKET = "bid a beat";
const LOGO_FOLDER = "Event images";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function storagePathFromPublicUrl(
  url: string | null,
  bucket: string
): string | null {
  if (!url) return null;
  const marker = "object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const after = url.slice(idx + marker.length);
  const sep = after.indexOf("/");
  if (sep === -1) return null;
  const bkt = decodeURIComponent(after.slice(0, sep));
  if (bkt !== bucket) return null;
  return decodeURIComponent(after.slice(sep + 1));
}

async function removeLogoIfAny(url: string | null): Promise<void> {
  const path = storagePathFromPublicUrl(url, LOGO_BUCKET);
  if (!path) return;
  try {
    await getSupabaseAdmin().storage.from(LOGO_BUCKET).remove([path]);
  } catch (err) {
    console.warn("[event] could not remove logo:", err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { eventId } = await params;
  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "dj") {
    return NextResponse.json(
      { error: "Only DJ accounts can update events." },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("events")
    .select("logo_url")
    .eq("id", eventId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
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

  const admin = getSupabaseAdmin();
  const logoFile = form.get("logo");
  const removeLogo = form.get("removeLogo") === "1";
  let logoUrl: string | null = existing.logo_url ?? null;

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

    const { error: uploadError } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(path, buffer, {
        contentType: logoFile.type || "application/octet-stream",
        upsert: false,
        cacheControl: "3600",
      });
    if (uploadError) {
      console.error("[update-event] logo upload failed:", uploadError);
      return NextResponse.json(
        { error: "Could not upload the logo image. Please try again." },
        { status: 500 }
      );
    }
    logoUrl = admin.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
    await removeLogoIfAny(existing.logo_url);
  } else if (removeLogo && existing.logo_url) {
    await removeLogoIfAny(existing.logo_url);
    logoUrl = null;
  }

  const { data, error } = await supabase
    .from("events")
    .update({
      name,
      act,
      event_date: date,
      event_time: time ? `${time}:00` : null,
      venue,
      pin,
      helper_pin: helperPin,
      palette,
      logo_url: logoUrl,
    })
    .eq("id", eventId)
    .select(EVENT_PROJECTION)
    .single();

  if (error) {
    console.error("[update-event] failed:", error);
    return NextResponse.json(
      { error: "Could not save changes. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, event: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { eventId } = await params;
  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "dj") {
    return NextResponse.json(
      { error: "Only DJ accounts can delete events." },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("events")
    .select("logo_url")
    .eq("id", eventId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) {
    console.error("[delete-event] failed:", error);
    return NextResponse.json(
      { error: "Could not delete the event. Please try again." },
      { status: 500 }
    );
  }

  await removeLogoIfAny(existing.logo_url);
  return NextResponse.json({ ok: true });
}