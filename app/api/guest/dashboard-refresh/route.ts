import { NextResponse } from "next/server";
import { getGuestDashboardData } from "@/features/guest/lib/guest-events";

export async function GET() {
  try {
    const data = await getGuestDashboardData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[dashboard-refresh] error:", err);
    return NextResponse.json(
      { error: "Failed to refresh dashboard" },
      { status: 500 }
    );
  }
}