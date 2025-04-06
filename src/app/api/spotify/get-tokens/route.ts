import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const access_token = cookieStore.get("spotify_access_token")?.value;
    const refresh_token = cookieStore.get("spotify_refresh_token")?.value;

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: "No tokens found" }, { status: 401 });
    }

    // Return the tokens as JSON
    return NextResponse.json({
      access_token,
      refresh_token,
    });
  } catch (error) {
    console.error("Error retrieving tokens:", error);
    return NextResponse.json(
      { error: "Failed to retrieve tokens" },
      { status: 500 }
    );
  }
}
