"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSpotifyActions } from "./SpotifyContext/SpotifyContext";

/**
 * Auth State
 */
// The default state when the user lands on the app
export const UnknownState = Symbol("Unknown State");

// Auth state assessment is underway
export const LoadingState = Symbol("Loading State");

export const LoggedInState = Symbol("Logged In State");

export const LoggedOutState = Symbol("Logged Out State");

type AuthState =
  | typeof LoggedInState
  | typeof LoggedOutState
  | typeof LoadingState
  | typeof UnknownState;

const AuthStateContext = React.createContext<AuthState>(UnknownState);

export const useAuthState = (): AuthState => {
  const context = React.useContext(AuthStateContext);
  if (!context) {
    throw Error("Attempted to use AuthState without a provider!");
  }
  return context;
};

/**
 * Auth Tokens
 */
interface AuthTokens {
  access_token: string | null;
  refresh_token: string | null;
}

const ZeroTokens = {
  access_token: null,
  refresh_token: null,
};

const AuthTokenContext = React.createContext<AuthTokens>(ZeroTokens);

export const useAuthTokens = (): AuthTokens => {
  const context = React.useContext(AuthTokenContext);
  if (!context) {
    throw Error("Attempted to use AuthTokens without a provider!");
  }
  return context;
};

/**
 * Auth Actions
 */
interface AuthActions {
  setLoggedIn: (tokens: AuthTokens) => Promise<void>;
  logout: () => void;
  processAuthCallback: () => Promise<void>;
}

const AuthActionContext = React.createContext<AuthActions | undefined>(
  undefined
);

export const useAuthActions = (): AuthActions => {
  const context = React.useContext(AuthActionContext);
  if (!context) {
    throw Error("Attempted to use AuthActions without a provider!");
  }
  return context;
};

// Helper to clear auth cookies
const clearCookies = () => {
  document.cookie = "spotify_access_token=; Max-Age=0; path=/; samesite=lax";
  document.cookie = "spotify_refresh_token=; Max-Age=0; path=/; samesite=lax";
  document.cookie = "spotify_token_expiry=; Max-Age=0; path=/; samesite=lax";
};

/**
 * AuthProvider Component
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = React.memo(
  ({ children }) => {
    const [authState, setAuthState] = React.useState<AuthState>(UnknownState);
    const [authTokens, setAuthTokens] = React.useState<AuthTokens>(ZeroTokens);
    const router = useRouter();

    const { initialize: initializeSpotify, teardown: teardownSpotify } =
      useSpotifyActions();

    // Function to handle logging out
    const logout = React.useCallback(() => {
      console.log("Logging out user");
      localStorage.removeItem("authTokens");
      clearCookies();
      setAuthState(LoggedOutState);
      setAuthTokens(ZeroTokens);
      teardownSpotify();
      router.push("/login");
    }, [teardownSpotify, router]);

    // Function to handle successful login
    const setLoggedIn = React.useCallback(
      async (tokens: AuthTokens) => {
        try {
          console.log("Setting auth tokens and logged in state");

          if (!tokens.access_token && !tokens.refresh_token) {
            throw new Error("No tokens found");
          }

          await initializeSpotify({
            access_token: tokens.access_token!,
            refresh_token: tokens.refresh_token!,
          });

          // Store tokens in localStorage for persistence
          localStorage.setItem("authTokens", JSON.stringify(tokens));

          setAuthTokens(tokens);
          setAuthState(LoggedInState);

          // Clear cookies as they're no longer needed
          clearCookies();
        } catch (e) {
          console.error(
            "Authorization failed! Could not initialize Spotify:",
            e
          );
          logout();
        }
      },
      [initializeSpotify, logout]
    );

    // Process OAuth callback - called by the callback handler component
    const processAuthCallback = React.useCallback(async () => {
      try {
        // Call server-side endpoint that reads the httpOnly cookies
        const response = await fetch("/api/spotify/get-tokens");
        if (!response.ok) {
          throw new Error("Failed to fetch tokens");
        }

        const tokens = await response.json();
        if (!tokens.access_token || !tokens.refresh_token) {
          throw new Error("No tokens found in response");
        }

        // Set the tokens in auth context
        await setLoggedIn({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });

        return;
      } catch (error) {
        console.error("Error processing auth callback:", error);
        throw error;
      }
    }, [setLoggedIn]);

    // Check authentication status on mount
    React.useEffect(() => {
      const checkAuthStatus = async () => {
        setAuthState(LoadingState);

        try {
          // Check if we have tokens in localStorage
          const storedTokens = localStorage.getItem("authTokens");
          if (storedTokens) {
            const tokens = JSON.parse(storedTokens) as AuthTokens;
            if (tokens.access_token && tokens.refresh_token) {
              console.log("Tokens found in localStorage, verifying...");

              // Refresh the token to make sure it's valid
              try {
                const response = await fetch("/api/spotify/refresh", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ refreshToken: tokens.refresh_token }),
                });

                if (!response.ok) {
                  throw new Error("Failed to refresh token");
                }

                const data = await response.json();
                await setLoggedIn({
                  access_token: data.access_token,
                  refresh_token: tokens.refresh_token,
                });
                return;
              } catch (error) {
                console.error("Failed to refresh token:", error);
                logout();
                return;
              }
            }
          }

          // If we get here, user is not authenticated
          setAuthState(LoggedOutState);
        } catch (error) {
          console.error("Error checking auth status:", error);
          setAuthState(LoggedOutState);
        }
      };

      if (authState === UnknownState) {
        console.log("Auth state is unknown, checking status...");
        checkAuthStatus();
      }
    }, [authState, logout, setLoggedIn]);

    // Create auth actions object
    const authActions: AuthActions = React.useMemo(
      () => ({ setLoggedIn, logout, processAuthCallback }),
      [setLoggedIn, logout, processAuthCallback]
    );

    // Don't render children until we know the auth state
    if (authState === UnknownState || authState === LoadingState) {
      return <div>Loading...</div>; // You can replace this with a proper loading component
    }

    return (
      <AuthStateContext.Provider value={authState}>
        <AuthTokenContext.Provider value={authTokens}>
          <AuthActionContext.Provider value={authActions}>
            {children}
          </AuthActionContext.Provider>
        </AuthTokenContext.Provider>
      </AuthStateContext.Provider>
    );
  }
);

AuthProvider.displayName = "AuthProvider";
