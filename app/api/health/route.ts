/**
 * API route handler for health checks.
 * Verify that the server is running and database is connected.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Check Supabase connection
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);

    if (error && error.code !== "PGRST116") {
      // PGRST116 is an expected error if the table is empty
      throw error;
    }

    return NextResponse.json(
      apiSuccess(
        {
          status: "healthy",
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        },
        "Server is healthy"
      )
    );
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      apiError(
        error instanceof Error ? error.message : "Unknown error",
        "Server health check failed"
      ),
      { status: 503 }
    );
  }
}
