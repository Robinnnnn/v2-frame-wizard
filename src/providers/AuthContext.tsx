"use client";

import React, { useCallback, useState } from "react";
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

// Add new state for client credentials only (browse-only mode)
export const BrowseOnlyState = Symbol("Browse Only State");

type AuthState =
  | typeof LoggedInState
  | typeof LoggedOutState
  | typeof LoadingState
  | typeof UnknownState
  | typeof BrowseOnlyState;

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

/**
 * Combined Auth Context with all values
 */
interface AuthContextValue {
  // Auth state
  authState: AuthState;
  // Auth tokens
  tokens: AuthTokens;
  // Client credentials state
  clientCredentialsToken: string | null;
  isClientCredentialsLoading: boolean;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined
);

/**
 * Combined Auth Actions Context with all actions
 */
interface AuthActionsContextValue {
  // Regular auth actions
  setLoggedIn: (tokens: AuthTokens) => Promise<void>;
  logout: () => void;
  processAuthCallback: () => Promise<void>;
  // Client credentials actions
  getClientCredentialsToken: () => Promise<string>;
}

const AuthActionsContext = React.createContext<
  AuthActionsContextValue | undefined
>(undefined);

// Helper to clear auth cookies
const clearCookies = () => {
  document.cookie = "spotify_access_token=; Max-Age=0; path=/; samesite=lax";
  document.cookie = "spotify_refresh_token=; Max-Age=0; path=/; samesite=lax";
  document.cookie = "spotify_token_expiry=; Max-Age=0; path=/; samesite=lax";
};

// Hook to access auth values
export const useAuth = (): AuthContextValue => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw Error("Attempted to use AuthContext without a provider!");
  }
  return context;
};

// Hook to access auth actions
export const useAuthActions = (): AuthActionsContextValue => {
  const context = React.useContext(AuthActionsContext);
  if (!context) {
    throw Error("Attempted to use AuthActionsContext without a provider!");
  }
  return context;
};

// Convenience hooks for common use cases
export const useAuthState = (): AuthState => {
  return useAuth().authState;
};

export const useAuthTokens = (): AuthTokens => {
  return useAuth().tokens;
};

/**
 * AuthProvider Component
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = React.memo(
  ({ children }) => {
    const [authState, setAuthState] = React.useState<AuthState>(UnknownState);
    const [authTokens, setAuthTokens] = React.useState<AuthTokens>(ZeroTokens);
    const router = useRouter();

    const [clientCredentialsToken, setClientCredentialsToken] = useState<
      string | null
    >(null);
    const [clientCredentialsExpiry, setClientCredentialsExpiry] = useState<
      number | null
    >(null);
    const [isClientCredentialsLoading, setIsClientCredentialsLoading] =
      useState(false);

    // Change from useState to useRef
    const hasAttemptedClientCredentialsRef = React.useRef(false);

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

    // Add a new method to initialize SDK with just client credentials
    const initializeWithClientCredentials = React.useCallback(
      async (accessToken: string) => {
        try {
          console.log("Initializing Spotify with client credentials only");

          // Call the initializeSpotify function with only the access token
          await initializeSpotify({
            access_token: accessToken,
            // No refresh token provided for client credentials flow
          });

          setAuthState(BrowseOnlyState);
        } catch (e) {
          console.error(
            "Failed to initialize Spotify with client credentials:",
            e
          );
          logout();
        }
      },
      [initializeSpotify, logout]
    );

    const getClientCredentialsToken = useCallback(async (): Promise<string> => {
      // Check if we have a valid token already
      if (
        clientCredentialsToken &&
        clientCredentialsExpiry &&
        Date.now() < clientCredentialsExpiry
      ) {
        return clientCredentialsToken;
      }

      setIsClientCredentialsLoading(true);
      try {
        const response = await fetch("/api/spotify/client-credentials");

        if (!response.ok) {
          const error = await response.json();
          throw new Error(
            error.error || "Failed to get client credentials token"
          );
        }

        const data = await response.json();
        const expiryTime = Date.now() + data.expires_in * 1000;

        setClientCredentialsToken(data.access_token);
        setClientCredentialsExpiry(expiryTime);

        // If we're in an unknown or logged out state, initialize SDK with client credentials
        if (authState === UnknownState || authState === LoggedOutState) {
          setAuthState(BrowseOnlyState);
          await initializeWithClientCredentials(data.access_token);
        }

        return data.access_token;
      } catch (error) {
        console.error("Error getting client credentials token:", error);
        throw error;
      } finally {
        setIsClientCredentialsLoading(false);
      }
    }, [
      clientCredentialsToken,
      clientCredentialsExpiry,
      authState,
      initializeWithClientCredentials,
    ]);

    // Function to handle getting client credentials as fallback
    const getClientCredentialsFallback = React.useCallback(
      async (errorContext: string = "general"): Promise<boolean> => {
        // Skip if we've already tried
        if (hasAttemptedClientCredentialsRef.current) {
          console.log(
            "Already attempted client credentials, skipping fallback"
          );
          return false;
        }

        hasAttemptedClientCredentialsRef.current = true;
        try {
          await getClientCredentialsToken();
          return true;
        } catch (credError) {
          console.error(
            `Failed to get client credentials (${errorContext}):`,
            credError
          );
          logout();
          return false;
        }
      },
      [getClientCredentialsToken, logout]
    );

    // Check authentication status on mount
    React.useEffect(() => {
      const checkAuthStatus = async () => {
        setAuthState(LoadingState);
        hasAttemptedClientCredentialsRef.current = false; // Reset flag on each check

        try {
          // Check if we have tokens in localStorage
          const storedTokens = localStorage.getItem("authTokens");
          if (storedTokens) {
            const tokens = JSON.parse(storedTokens) as AuthTokens;
            if (tokens.access_token && tokens.refresh_token) {
              console.log("Tokens found in localStorage, verifying...");

              // Refresh the token to make sure it's valid
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
            }
          } else {
            // If we get here, user is not authenticated with tokens
            // Try to get client credentials as fallback
            await getClientCredentialsFallback("no auth tokens");
          }
        } catch (error) {
          console.error("Error checking auth status:", error);
          // Try client credentials as a last resort, but only if we haven't tried already
          if (!hasAttemptedClientCredentialsRef.current) {
            await getClientCredentialsFallback("auth status check");
          } else {
            logout();
          }
        }
      };

      if (authState === UnknownState) {
        console.log("Auth state is unknown, checking status...");
        checkAuthStatus();
      }
    }, [
      authState,
      logout,
      setLoggedIn,
      getClientCredentialsToken,
      getClientCredentialsFallback,
      // No need to include hasAttemptedClientCredentialsRef in dependencies
    ]);

    // Create a combined context value object
    const authContextValue: AuthContextValue = {
      authState,
      tokens: authTokens,
      clientCredentialsToken,
      isClientCredentialsLoading,
    };

    // Create a combined actions object
    const authActionsValue: AuthActionsContextValue = {
      setLoggedIn,
      logout,
      processAuthCallback,
      getClientCredentialsToken,
    };

    console.log("Auth state:", authState);

    // Don't render children until we know the auth state
    if (authState === UnknownState || authState === LoadingState) {
      return <div>Loading...</div>; // You can replace this with a proper loading component
    }

    return (
      <AuthContext.Provider value={authContextValue}>
        <AuthActionsContext.Provider value={authActionsValue}>
          {children}
        </AuthActionsContext.Provider>
      </AuthContext.Provider>
    );
  }
);

AuthProvider.displayName = "AuthProvider";
