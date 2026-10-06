import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getDjConnectStatus } from "@/features/dj/lib/dj-connect";

/**
 * GET /api/dj/connect/status
 *
 * Live Connect status for the current DJ. Used by the dashboard to poll
 * after the Stripe onboarding return redirect so the UI updates without
 * a full page reload.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const status = await getDjConnectStatus(user.id);
  return NextResponse.json(status);
}