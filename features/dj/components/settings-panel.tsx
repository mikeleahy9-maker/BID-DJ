"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import ShareProfileButton from "@/features/dj/components/share-profile-button";

const MAX_TAGS = 5;
const MAX_TAGS_HINT = `Add up to ${MAX_TAGS} tags`;

interface SettingsInitial {
  actName: string;
  email: string;
  city: string;
  description: string;
  tags: string[];
  avatarUrl: string | null;
  publicSlug: string | null;
  publicUrl: string | null;
}

/**
 * Account settings — profile, revenue split, danger zone.
 *
 * Profile fields (act name, bio, city, tags, photo) load from the real
 * `profiles` row and save through PATCH /api/dj/profile, which writes the
 * text fields and uploads the photo to the shared storage bucket. Bank /
 * payout method and Owner PIN are intentionally hidden for now.
 */
export default function SettingsPanel({ initial }: { initial: SettingsInitial }) {
  const router = useRouter();
  const { show, toastNode } = useToast();

  const [actName, setActName] = useState(initial.actName);
  const [city, setCity] = useState(initial.city);
  const [description, setDescription] = useState(initial.description);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [tagInput, setTagInput] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-neon disabled:opacity-60";
  const labelCls = "text-[11px] uppercase tracking-[1px] text-muted";
  const section = "rounded-xl border border-edge bg-surface p-5 flex flex-col gap-3";

  const previewPhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") setPhotoPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const addTag = () => {
    const clean = tagInput.trim();
    if (!clean) return;
    if (tags.length >= MAX_TAGS) {
      show(`You can add up to ${MAX_TAGS} tags`);
      return;
    }
    if (tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTagInput("");
      return;
    }
    setTags([...tags, clean]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!actName.trim()) {
      show("Please enter an act / stage name");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("actName", actName.trim());
      fd.set("description", description.trim());
      fd.set("city", city.trim());
      fd.set("tags", JSON.stringify(tags));
      const photo = photoInputRef.current?.files?.[0];
      if (photo) fd.set("photo", photo);

      const res = await fetch("/api/dj/profile", { method: "PATCH", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        show(data?.error ?? "Could not save your profile. Please try again.");
        return;
      }
      if ("avatar_url" in (data?.profile ?? {})) {
        setAvatarUrl(data.profile.avatar_url ?? null);
      }
      if (photoInputRef.current) photoInputRef.current.value = "";
      setPhotoPreview(null);
      show("Profile saved!");
      router.refresh();
    } catch {
      show("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const shownAvatar = photoPreview ?? avatarUrl;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {/* Profile */}
      <section className={section}>
        <h2 className="font-display text-lg tracking-[1.5px] text-neon">Profile</h2>

        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-edge bg-surface-2 text-3xl">
            {shownAvatar && shownAvatar.startsWith("http") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownAvatar} alt="Profile" className="h-full w-full object-cover" />
            ) : shownAvatar && !shownAvatar.startsWith("http") ? (
              shownAvatar
            ) : (
              <span aria-hidden>🎛️</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => previewPhoto(e.target.files?.[0])}
            />
            <div className="flex gap-2">
              <button
                onClick={() => photoInputRef.current?.click()}
                className="rounded-lg border border-edge bg-surface-2 px-4 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
              >
                Upload Photo
              </button>
              {(avatarUrl || photoPreview) && (
                <button
                  onClick={() => {
                    setAvatarUrl(null);
                    setPhotoPreview(null);
                    if (photoInputRef.current) photoInputRef.current.value = "";
                  }}
                  className="rounded-lg border border-edge bg-surface-2 px-4 py-2 text-xs font-bold text-muted transition hover:border-neon-2 hover:text-neon-2"
                >
                  Remove
                </button>
              )}
            </div>
            <span className="text-[10px] text-muted">PNG, JPG or WEBP · max 10MB</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Act / Stage Name</label>
          <input
            className={inputCls}
            value={actName}
            onChange={(e) => setActName(e.target.value)}
            placeholder="DJ Phantom"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Bio / Description</label>
          <textarea
            className={`${inputCls} min-h-[110px] resize-y leading-[1.6]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell guests about your sound, your vibe, the nights you run…"
            maxLength={500}
          />
          <span className="self-end text-[10px] text-muted">
            {description.length}/500
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>City</label>
          <input
            className={inputCls}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Los Angeles"
            autoComplete="address-level2"
          />
        </div>

        {/* Tags (max 5) */}
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Tags</label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/5 px-2.5 py-1 text-[11px] font-semibold text-neon"
                >
                  {t}
                  <button
                    onClick={() => removeTag(t)}
                    aria-label={`Remove ${t}`}
                    className="cursor-pointer border-none bg-transparent text-neon/70 transition hover:text-neon-2"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="e.g. House, 90s, Deep…"
              disabled={tags.length >= MAX_TAGS}
            />
            <button
              onClick={addTag}
              disabled={tags.length >= MAX_TAGS || !tagInput.trim()}
              className="shrink-0 cursor-pointer rounded-lg border border-edge bg-surface-2 px-4 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <span className="text-[10px] text-muted">
            {tags.length}/{MAX_TAGS} · {MAX_TAGS_HINT}
          </span>
        </div>

        {/* Email is read-only (managed by login) */}
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Email</label>
          <input type="email" className={inputCls} value={initial.email} disabled readOnly />
          <span className="text-[10px] text-muted">
            Email is managed by your login, so it can&apos;t be changed here.
          </span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-1 self-start cursor-pointer rounded-lg border border-edge bg-surface-2 px-4 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "SAVING…" : "Save Profile"}
        </button>
      </section>

      {/* Public profile page */}
      {initial.publicUrl && (
        <section className={section}>
          <h2 className="font-display text-lg tracking-[1.5px] text-neon">
            🌐 Your Public Page
          </h2>
          <p className="text-xs leading-[1.6] text-muted">
            Anyone with this link can see your name, photo, bio, tags and
            gigs — no sign in needed. Share it anywhere.
          </p>
          <div className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-xs text-neon">
                {initial.publicUrl}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href={initial.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-edge bg-surface px-4 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
              >
                <span aria-hidden>👁</span> View
              </Link>
              <ShareProfileButton url={initial.publicUrl} />
            </div>
          </div>
        </section>
      )}

      {/* Revenue split */}
      <section className={section}>
        <h2 className="font-display text-lg tracking-[1.5px] text-neon">💰 Revenue Split</h2>
        <p className="text-xs leading-[1.6] text-muted">
          BidaBeat manages all payments and payouts automatically via Stripe.
        </p>
        <div className="flex flex-col gap-2">
          {[
            { icon: "🏛️", label: "Event Organizer", value: "70%", color: "text-accent" },
            { icon: "🎛️", label: "DJ / Band", value: "20%", color: "text-neon" },
            { icon: "⚡", label: "BidaBeat platform", value: "10%", color: "text-[#ff8800]" },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-[13px]">
                <span aria-hidden>{row.icon}</span>
                {row.label}
              </span>
              <span className={`font-display text-2xl ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] leading-[1.6] text-muted">
          Unused guest credits are auto-donated to the organizer and are
          included in the split. Payouts arrive 2–3 business days after event
          end.
        </p>
      </section>

      {/* Danger zone */}
      <section className={`${section} border-neon-2/30`}>
        <h2 className="font-display text-lg tracking-[1.5px] text-neon-2">Danger Zone</h2>
        <button
          onClick={() => show("Contact support to delete your account")}
          className="self-start cursor-pointer rounded-lg border border-neon-2 px-4 py-2 text-xs font-bold text-neon-2 transition hover:bg-neon-2/10"
        >
          Delete Account
        </button>
      </section>

      {toastNode}
    </div>
  );
}