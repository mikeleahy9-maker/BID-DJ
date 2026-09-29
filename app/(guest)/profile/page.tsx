import {
  getCurrentUser,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { GuestEditProfile } from "@/features/guest/components/guest-edit-profile";

export const metadata = {
  title: "Edit Profile",
  description: "Update your name and location shown in the BidaBeat event queue.",
};

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "first_name, last_name, display_name, city, phone, email"
    )
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const firstName = profile?.first_name ?? "";
  const lastName = profile?.last_name ?? "";
  const displayName = profile?.display_name ?? "";
  const city = profile?.city ?? "";

  return (
    <GuestEditProfile
      initial={{
        firstName,
        lastName,
        displayName: displayName || firstName || lastName,
        city,
        phone: profile?.phone ?? "",
        email: profile?.email ?? user?.email ?? "",
      }}
    />
  );
}