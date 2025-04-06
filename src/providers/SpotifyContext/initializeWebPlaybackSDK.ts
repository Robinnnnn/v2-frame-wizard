import { refreshAndCacheAccessToken } from "./refreshAndCacheAccessToken";
import SpotifySDK from "spotify-web-api-js";
import { InitializedPlaybackSDK } from "./SpotifyContext";
// We need this one for actually playing music out of the user's browser.
// It also registers the browser window as a connected device.
// https://developer.spotify.com/documentation/web-playback-sdk/quick-start/
export async function initializeWebPlaybackSDK({
  refresh_token,
  sdk,
}: {
  refresh_token: string;
  sdk: SpotifySDK.SpotifyWebApiJs;
}): Promise<InitializedPlaybackSDK> {
  console.log("initializing web playback sdk");

  // Programmatically load Connect SDK
  const script = document.createElement("script");
  script.src = "https://sdk.scdn.co/spotify-player.js";
  script.async = true;
  document.body.appendChild(script);

  try {
    const Player = await getWebPlaybackPlayer();

    const player = new Player({
      name: "Good Vibes Only 💖",
      volume: 1.0,
      getOAuthToken: async (callback: (token: string) => void) => {
        const refreshedAccessToken: string = await refreshAndCacheAccessToken(
          refresh_token,
          sdk
        );
        callback(refreshedAccessToken);
      },
    });

    return new Promise((resolve, reject) => {
      // Successful connection
      player.addListener("ready", (s) => {
        console.log("established connection with web playback sdk");
        resolve({ player, playbackInstance: s });
      });

      // Error handling
      player.addListener("not_ready", ({ device_id }) =>
        reject(`Device ID is not available: ${device_id}`)
      );
      player.addListener("initialization_error", ({ message }) =>
        reject(message)
      );
      player.addListener("authentication_error", ({ message }) =>
        reject(message)
      );
      player.addListener("account_error", ({ message }) => reject(message));
      player.addListener("playback_error", ({ message }) => reject(message));

      // Attempt connection
      player.connect();
    });
  } catch (e) {
    console.error("failed to initialize web playback sdk");
    throw e;
  }
}

// Detects and returns whether the SDK is loaded properly on the DOM
function getSpotifyWebPlaybackSDK(): Promise<typeof Spotify> {
  return new Promise((resolve) => {
    if (window.Spotify) resolve(window.Spotify);
    else window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
  });
}

async function getWebPlaybackPlayer(): Promise<typeof Spotify.Player> {
  try {
    const spotify = await getSpotifyWebPlaybackSDK();
    return spotify.Player;
  } catch (e) {
    console.error("failed to get spotify web playback sdk from the window");
    throw e;
  }
}
