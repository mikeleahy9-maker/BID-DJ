import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const LOGO_BUCKET = "bid a beat";
const PHOTO_FOLDER = "Profile images";
const MAX_TAGS = 5;

/**
 * Save the signed-in DJ's public profile: act name, bio, city, tags and an
 * optional profile photo. Profile photo is written to the shared storage
 * bucket (admin client, same as event logos) and stored in profiles.avatar_url.
 */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const str = (key: string) => String(form.get(key) ?? "").trim();

  const actName = str("actName");
  const description = str("description");
  const city = str("city");
  const rawTags = str("tags");

  let tags: string[] = [];
  try {
    const parsed = JSON.parse(rawTags || "[]");
    if (Array.isArray(parsed)) {
      tags = parsed
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, MAX_TAGS);
    }
  } catch {
    return NextResponse.json({ error: "Invalid tags." }, { status: 400 });
  }

  if (!actName) {
    return NextResponse.json(
      { error: "Please enter an act / stage name." },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServerClient();

  let avatarUrl: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Profile photo must be under 10MB." },
        { status: 400 }
      );
    }
    const ext =
      (photo.name.split(".").pop() ?? "png")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "png";
    const path = `${PHOTO_FOLDER}/${user.id}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());

    const admin = getSupabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(path, buffer, {
        contentType: photo.type || "application/octet-stream",
        upsert: false,
        cacheControl: "3600",
      });
    if (uploadError) {
      console.error("[dj/profile] photo upload failed:", uploadError);
      return NextResponse.json(
        { error: "Could not upload the profile photo. Please try again." },
        { status: 500 }
      );
    }
    avatarUrl = admin.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const patch: Record<string, unknown> = {
    act_name: actName,
    description: description || null,
    city: city || null,
    tags,
    avatar_url: avatarUrl,
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("act_name, description, city, tags, avatar_url")
    .single();

  if (error) throw error;

  return NextResponse.json({ ok: true, profile: data });
}