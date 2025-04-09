"use client";

import React from "react";
import { initializeSpotifySDK } from "./initializeSpotifySDK";
import { initializeWebPlaybackSDK } from "./initializeWebPlaybackSDK";
import SpotifySDK from "spotify-web-api-js";

type SpotifyState = {
  // main spotify SDK for basically all requests
  sdk: SpotifySDK.SpotifyWebApiJs;
  // web playback SDK needed for registering browser as a device
  player: Spotify.Player;
  // playback SDK instance needed for connecting player
  playbackInstance: Spotify.WebPlaybackInstance;
  // we clear this out on teardown
  refreshTokenIntervalId: number;
  // user info
  user: SpotifyApi.CurrentUsersProfileResponse;
};

const SpotifyStateContext = React.createContext<SpotifyState | undefined>(
  undefined
);

export const useSpotifyState = (): SpotifyState => {
  const context = React.useContext(SpotifyStateContext);
  if (!context) {
    throw Error("Attempted to use SpotifyState without a provider!");
  }
  return context;
};

export type InitSpotifySDKParams = {
  access_token: string;
  refresh_token?: string;
};

type InitializedSpotifySDK = {
  sdk: SpotifySDK.SpotifyWebApiJs;
  refreshTokenIntervalId?: number;
};

export type InitializedPlaybackSDK = {
  player: Spotify.Player;
  playbackInstance: Spotify.WebPlaybackInstance;
};

type SpotifyActions = {
  initialize: (i: InitSpotifySDKParams) => void;
  teardown: () => void;
};

const SpotifyActionContext = React.createContext<SpotifyActions | undefined>(
  undefined
);

export const useSpotifyActions = (): SpotifyActions => {
  const context = React.useContext(SpotifyActionContext);
  if (!context) {
    throw Error("Attempted to use SpotifyActions without a provider!");
  }
  return context;
};

export const SpotifyProvider: React.FC<{ children: React.ReactNode }> =
  React.memo(({ children }) => {
    const [spotifyState, setSpotifyState] = React.useState<
      SpotifyState | undefined
    >(undefined);

    const initialize = React.useCallback(
      async ({ access_token, refresh_token }: InitSpotifySDKParams) => {
        console.log("Initializing spotify");
        const initParams: InitSpotifySDKParams = {
          access_token,
          refresh_token,
        };
        const { sdk, refreshTokenIntervalId }: InitializedSpotifySDK =
          initializeSpotifySDK(initParams);

        if (refresh_token && refreshTokenIntervalId) {
          try {
            const playbackSdk: InitializedPlaybackSDK =
              await initializeWebPlaybackSDK({
                refresh_token,
                sdk,
              });

            const user: SpotifyApi.CurrentUsersProfileResponse =
              await sdk.getMe();

            console.log(`Retrieved user: ${user.id}`);
            setSpotifyState({
              sdk,
              refreshTokenIntervalId,
              player: playbackSdk.player,
              playbackInstance: playbackSdk.playbackInstance,
              user,
            });
          } catch (e) {
            console.error(`Failed to initialize spotify:`, e);
            throw e;
          }
        }
      },
      []
    );

    const teardown = React.useCallback(() => {
      console.log("Tearing down spotify");
      if (spotifyState) {
        const { refreshTokenIntervalId, player } = spotifyState;
        window.clearInterval(refreshTokenIntervalId);
        player.disconnect();
        setSpotifyState(undefined);
      }
    }, [spotifyState]);

    const actions: SpotifyActions = React.useMemo(
      () => ({ initialize, teardown }),
      [initialize, teardown]
    );

    return (
      <SpotifyStateContext.Provider value={spotifyState}>
        <SpotifyActionContext.Provider value={actions}>
          {children}
        </SpotifyActionContext.Provider>
      </SpotifyStateContext.Provider>
    );
  });

SpotifyProvider.displayName = "SpotifyProvider";
