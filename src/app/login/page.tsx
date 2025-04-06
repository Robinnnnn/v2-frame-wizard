"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthState, LoggedInState } from "~/providers/AuthContext";

const LoginPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authState = useAuthState();
  const error = searchParams.get("error");

  useEffect(() => {
    // If already logged in, redirect to home
    if (authState === LoggedInState) {
      router.push("/");
    }
  }, [authState, router]);

  // Show error message if present
  const errorMessage = error ? (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      Error: {error === "server_error" ? "Server error occurred" : error}
    </div>
  ) : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {errorMessage}
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Login to Spotify
        </h1>

        <button
          className="w-full bg-green-500 hover:bg-green-600 font-bold py-3 px-4 rounded-full"
          onClick={() => {
            window.location.href = "/api/spotify/login";
          }}
        >
          Continue with Spotify
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
