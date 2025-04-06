"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "~/providers/AuthContext";

const AuthCallbackPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { processAuthCallback } = useAuthActions();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we have an error from Spotify
        const spotifyError = searchParams.get("error");
        if (spotifyError) {
          throw new Error(spotifyError);
        }

        // Process the auth callback (fetch tokens, initialize)
        await processAuthCallback();

        // Redirect to home page on success
        router.push("/");
      } catch (err) {
        console.error("Auth callback failed:", err);
        setError(err instanceof Error ? err.message : "Unknown error");

        // Delay redirect to show error
        setTimeout(() => {
          router.push(
            `/login?error=${encodeURIComponent(error || "auth_failed")}`
          );
        }, 2000);
      }
    };

    handleCallback();
  }, [processAuthCallback, router, searchParams, error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authorizing with Spotify</h1>
        {error ? (
          <p className="text-red-500 mb-2">Error: {error}</p>
        ) : (
          <p className="mb-2">Please wait while we complete your login...</p>
        )}
        {/* Add a loading spinner here */}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
