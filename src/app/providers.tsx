"use client";

import dynamic from "next/dynamic";
import { FrameSDKProvider } from "~/providers/FrameSDKContext";
import { WizardProvider } from "~/providers/WizardContext";
import { SafeAreaWrapper } from "~/components/SafeAreaWrapper";
import { SpotifyProvider } from "~/providers/SpotifyContext/SpotifyContext";
import { AuthProvider } from "~/providers/AuthContext";

const WagmiProvider = dynamic(() => import("~/providers/WagmiProvider"), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider>
      <SafeAreaWrapper>
        <FrameSDKProvider>
          <SpotifyProvider>
            <AuthProvider>
              <WizardProvider>{children}</WizardProvider>
            </AuthProvider>
          </SpotifyProvider>
        </FrameSDKProvider>
      </SafeAreaWrapper>
    </WagmiProvider>
  );
}
