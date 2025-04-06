import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    // Parse the URL to extract query parameters
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Get the stored state from cookies
    const storedState = (await cookies()).get("spotify_auth_state")?.value;

    // Get environment variables
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify/oauth`
      : `${new URL(request.url).origin}/api/spotify/oauth`;
    const frontendRedirectUri = process.env.NEXT_PUBLIC_BASE_URL || "";

    // Clear the state cookie
    (await cookies()).delete("spotify_auth_state");

    // Handle errors or state mismatch
    if (error) {
      return NextResponse.redirect(`${frontendRedirectUri}?error=${error}`);
    }

    if (!state || !storedState || state !== storedState) {
      return NextResponse.redirect(
        `${frontendRedirectUri}?error=state_mismatch`
      );
    }

    if (!code) {
      return NextResponse.redirect(`${frontendRedirectUri}?error=no_code`);
    }

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${frontendRedirectUri}?error=server_config_error`
      );
    }

    // Create authorization header (Base64 encoded client_id:client_secret)
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    // Prepare form data for token request
    const formData = new URLSearchParams();
    formData.append("grant_type", "authorization_code");
    formData.append("code", code);
    formData.append("redirect_uri", redirectUri);

    // Exchange authorization code for access token
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    // Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Spotify token error:", errorText);
      return NextResponse.redirect(
        `${frontendRedirectUri}?error=spotify_token_error`
      );
    }

    const { access_token, refresh_token, expires_in } = await response.json();

    // Set refresh token in HTTP-only cookie
    (await cookies()).set("spotify_refresh_token", refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Set access token in HTTP-only cookie
    (await cookies()).set("spotify_access_token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expires_in, // Same lifetime as the token
    });

    // Store expiration time
    (await cookies()).set(
      "spotify_token_expiry",
      (Date.now() + expires_in * 1000).toString(),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: expires_in,
      }
    );

    // Redirect without exposing tokens
    return NextResponse.redirect(`${frontendRedirectUri}/auth/callback`);
  } catch (error) {
    console.error("Error during Spotify OAuth callback:", error);
    const frontendRedirectUri = process.env.NEXT_PUBLIC_BASE_URL || "";
    return NextResponse.redirect(
      `${frontendRedirectUri}/login?error=server_error`
    );
  }
}
