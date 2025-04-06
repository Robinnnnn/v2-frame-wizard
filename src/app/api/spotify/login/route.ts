import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

// Helper function to generate a random string for state verification
function generateRandomString(length: number): string {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  // Using Node.js randomBytes instead of browser's getRandomValues
  const bytes = crypto.randomBytes(length);

  return Array.from(bytes)
    .map((b) => possible[b % possible.length])
    .join("");
}

export async function GET(request: Request) {
  try {
    // Get environment variables
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify/oauth`
      : `${new URL(request.url).origin}/api/spotify/oauth`;

    if (!clientId) {
      return NextResponse.json(
        { error: "Server configuration error: missing client ID" },
        { status: 500 }
      );
    }

    // Generate a random state value for security
    const state = generateRandomString(50);

    // Store state in a cookie for verification during callback
    (await cookies()).set("spotify_auth_state", state, {
      maxAge: 60 * 5, // 5 minutes
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    // Define the scopes we need
    const scope = [
      "user-read-private",
      //   "user-read-email",
      "streaming",
      "user-read-playback-state",
      "user-modify-playback-state",
    ].join(" ");

    // Build the Spotify authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: scope,
      redirect_uri: redirectUri,
      state: state,
    });

    // Redirect to Spotify authorization page
    return NextResponse.redirect(
      `https://accounts.spotify.com/authorize?${params.toString()}`
    );
  } catch (error) {
    console.error("Error initiating Spotify login:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
