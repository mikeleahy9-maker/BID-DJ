import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GuestQueuePage } from "@/features/guest/components/guest-queue-page";
import { joinEventAsGuest } from "@/features/guest/lib/guest-events";

export const metadata = {
  title: "Live Queue",
  description: "Request songs and watch the live queue.",
};

interface RequestPageProps {
  searchParams: Promise<{ event?: string | string[] }>;
}

export default async function RequestPage({ searchParams }: RequestPageProps) {
  const { event } = await searchParams;
  const code = Array.isArray(event) ? event[0] : event;
  if (!code) {
    redirect("/dashboard");
  }

  const normalized = code.trim().toUpperCase();
  const supabase = await getSupabaseServerClient();

  const { data: ev } = await supabase
    .from("events")
    .select("id, name, act, code")
    .eq("code", normalized)
    .eq("status", "live")
    .maybeSingle();

  if (!ev) {
    redirect("/dashboard");
  }

  await joinEventAsGuest(ev.id);

  return (
    <GuestQueuePage
      event={{
        id: ev.id,
        name: ev.name,
        djName: ev.act || "DJ",
        code: ev.code,
      }}
    />
  );
}