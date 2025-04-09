import { NextResponse } from "next/server";

export async function GET() {
  try {
    const client_id = process.env.SPOTIFY_CLIENT_ID;
    const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!client_id || !client_secret) {
      throw new Error("Missing Spotify credentials in environment variables");
    }

    // Create authorization header using base64 encoded client_id:client_secret
    const authHeader = Buffer.from(`${client_id}:${client_secret}`).toString(
      "base64"
    );

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Spotify API error: ${
          errorData.error_description || errorData.error || response.statusText
        }`
      );
    }

    const tokenData = await response.json();

    return NextResponse.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
    });
  } catch (error) {
    console.error("Client credentials error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
