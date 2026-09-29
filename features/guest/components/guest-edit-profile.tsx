"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { Field, FieldRow, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * GuestEditProfile — "Edit Profile" in the guest account dashboard.
 *
 * Lets the guest update the name the DJ sees in the queue (first/last/display)
 * plus their city. Saves are written straight through the authenticated
 * Supabase client — RLS (profiles_update_own) already scopes updates to the
 * caller's own row, so no API route is needed here.
 */
export function GuestEditProfile({
  initial,
}: {
  initial: {
    firstName: string;
    lastName: string;
    displayName: string;
    city: string;
    phone: string;
    email: string;
  };
}) {
  const router = useRouter();
  const { show, toastNode } = useToast();

  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [city, setCity] = useState(initial.city);
  const [phone, setPhone] = useState(initial.phone);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    displayName?: string;
    city?: string;
    phone?: string;
  }>({});

  const clearError = (key: keyof typeof errors) =>
    setErrors((prev) => ({ ...prev, [key]: undefined }));

  const validate = () => {
    const next: NonNullable<typeof errors> = {};

    if (!firstName.trim() && !lastName.trim()) {
      next.firstName = "Enter a first or last name";
    } else {
      if (firstName.trim() && firstName.trim().length < 2) {
        next.firstName = "First name must be at least 2 characters";
      }
      if (lastName.trim() && lastName.trim().length < 2) {
        next.lastName = "Last name must be at least 2 characters";
      }
    }

    if (displayName.trim() && displayName.trim().length < 2) {
      next.displayName = "Display name must be at least 2 characters";
    }

    if (city.trim() && city.trim().length < 2) {
      next.city = "City must be at least 2 characters";
    }

    const phoneTrimmed = phone.trim();
    if (phoneTrimmed) {
      const digits = phoneTrimmed.replace(/[^\d]/g, "");
      if (digits.length < 7 || digits.length > 10) {
        next.phone = "Enter a valid phone number (7–10 digits)";
      } else if (!/^[+()\-.\s\d]+$/.test(phoneTrimmed)) {
        next.phone = "Phone can only contain digits and + - ( ) . or spaces";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/[^+()\-.\s\d]/g, "");
    let digits = 0;
    const capped: string[] = [];
    for (const ch of cleaned) {
      if (/\d/.test(ch)) {
        if (digits >= 10) break;
        digits += 1;
      }
      capped.push(ch);
    }
    setPhone(capped.join(""));
    clearError("phone");
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          display_name: displayName.trim() || null,
          city: city.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
      if (error) throw error;

      show("Profile updated");
      router.refresh();
    } catch (err) {
      show(
        err instanceof Error ? err.message : "Could not update your profile."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageContainer className="py-8 md:py-14">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 cursor-pointer border-none bg-transparent text-xs text-muted transition hover:text-neon"
        >
          ← Back to dashboard
        </button>

        <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-start md:gap-12">
          {/* Left — copy + account summary */}
          <div className="md:pt-2">
            <div className="mb-5">
              <div className="mb-2 flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-neon"
                  aria-hidden
                />
                <span className="text-[11px] uppercase tracking-[2px] text-neon">
                  Edit profile
                </span>
              </div>
              <h1 className="font-display text-[28px] tracking-[2px] md:text-4xl">
                Who are you?
              </h1>
              <p className="mt-2 text-[13px] leading-[1.7] text-muted">
                The DJ sees your name when you request and bid. Keep it your
                actual name or a nickname — completely up to you.
              </p>
            </div>

            <div className="mb-5 rounded-xl border border-edge bg-surface px-4 py-4">
              <div className="text-[11px] uppercase tracking-[1px] text-muted">
                Account email
              </div>
              <div className="mt-1 truncate text-sm font-semibold">
                {initial.email || "—"}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                Email is managed by your login, so it can&apos;t be changed here.
              </div>
            </div>

            <ul className="hidden space-y-3 text-sm text-foreground/80 md:block">
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                  🪪
                </span>
                Your display name is what performers see in the queue
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                  📍
                </span>
                Adding your city helps nearby gigs find you
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                  🔒
                </span>
                Your details are private — only the DJ of an event you join sees
                your display name
              </li>
            </ul>
          </div>

          {/* Right — editable fields */}
          <div className="rounded-xl border border-edge bg-surface p-6 md:p-8">
            <div className="mb-4 text-[11px] uppercase tracking-[2px] text-muted">
              Profile details
            </div>

            <div className="space-y-4">
              <FieldRow>
                <Field label="First name" className="flex-1">
                  <Input
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      clearError("firstName");
                    }}
                    onBlur={validate}
                    placeholder="Alex"
                    autoComplete="given-name"
                    className={errors.firstName ? "!border-neon-2" : ""}
                  />
                  {errors.firstName && (
                    <span className="text-[11px] text-neon-2">{errors.firstName}</span>
                  )}
                </Field>
                <Field label="Last name" className="flex-1">
                  <Input
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      clearError("lastName");
                    }}
                    onBlur={validate}
                    placeholder="Rivera"
                    autoComplete="family-name"
                    className={errors.lastName ? "!border-neon-2" : ""}
                  />
                  {errors.lastName && (
                    <span className="text-[11px] text-neon-2">{errors.lastName}</span>
                  )}
                </Field>
              </FieldRow>

              <Field label="Display name (shown to DJs)">
                <Input
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    clearError("displayName");
                  }}
                  onBlur={validate}
                  placeholder="Alex Rivera"
                  autoComplete="nickname"
                  className={errors.displayName ? "!border-neon-2" : ""}
                />
                {errors.displayName && (
                  <span className="text-[11px] text-neon-2">{errors.displayName}</span>
                )}
              </Field>

              <FieldRow>
                <Field label="City" className="flex-1">
                  <Input
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      clearError("city");
                    }}
                    onBlur={validate}
                    placeholder="Los Angeles"
                    autoComplete="address-level2"
                    className={errors.city ? "!border-neon-2" : ""}
                  />
                  {errors.city && (
                    <span className="text-[11px] text-neon-2">{errors.city}</span>
                  )}
                </Field>
                <Field label="Phone (optional)" className="flex-1">
                  <Input
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onBlur={validate}
                    placeholder="555-000-1234"
                    autoComplete="tel"
                    inputMode="tel"
                    className={errors.phone ? "!border-neon-2" : ""}
                  />
                  {errors.phone && (
                    <span className="text-[11px] text-neon-2">{errors.phone}</span>
                  )}
                </Field>
              </FieldRow>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-6 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[16px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "SAVING…" : "SAVE CHANGES →"}
            </button>

            <div className="mt-4 border-t border-edge pt-4 md:hidden">
              <ul className="space-y-3 text-sm text-foreground/80">
                <li className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                    🪪
                  </span>
                  Your display name is what performers see in the queue
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                    📍
                  </span>
                  Adding your city helps nearby gigs find you
                </li>
              </ul>
            </div>
          </div>
        </div>
      </PageContainer>
      {toastNode}
    </>
  );
}