import SpotifySDK from "spotify-web-api-js";

// Takes a user refresh token and returns a new access token
export async function refreshAndCacheAccessToken(
  refreshToken: string,
  spotify: SpotifySDK.SpotifyWebApiJs
): Promise<string> {
  const accessToken = await requestRefreshedAccessToken(refreshToken);
  spotify.setAccessToken(accessToken);
  return accessToken;
}

export async function requestRefreshedAccessToken(
  refreshToken: string
): Promise<string> {
  const res = await fetch(`/api/spotify/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });
  const body = await res.json();

  console.log("refreshed user access token");

  return body.access_token;
}
