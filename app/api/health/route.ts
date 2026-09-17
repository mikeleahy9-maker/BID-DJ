/**
 * API route handler for health checks.
 * Verify that the server is running and database is connected.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Debug: Check if env vars are available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        environment: process.env.NODE_ENV,
      });
      return NextResponse.json(
        apiError(
          "Missing Supabase environment variables. Check Vercel Environment Variables settings.",
          "Server health check failed - configuration issue",
          {
            hasUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            hasKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            // hasUrl: !!supabaseUrl,
            // hasKey: !!supabaseKey,
            environment: process.env.NODE_ENV,
          }
        ),
        { status: 503 }
      );
    }

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
