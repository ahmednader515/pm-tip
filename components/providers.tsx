"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/providers/toaster-provider";
import { Toaster } from "sonner";
import { RTLProvider } from "@/components/providers/rtl-provider";
import { ThemeProvider as BrandThemeProvider } from "@/components/theme-provider";
import { NavigationProvider } from "@/lib/contexts/navigation-context";
import { SessionMonitor } from "@/components/session-monitor";
import { useEffect } from "react";

// Component to handle session loading states
const SessionHandler = ({ children }: { children: React.ReactNode }) => {
  const { data: session, status } = useSession();

  useEffect(() => {
    // Log session status for debugging
    if (process.env.NODE_ENV === "development") {
      console.log("Session status:", status, "Session:", session);
    }
  }, [session, status]);

  return <>{children}</>;
};

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <SessionProvider
      refetchInterval={0} // Disable automatic refetching
      refetchOnWindowFocus={false} // Disable refetch on window focus
      refetchWhenOffline={false} // Don't refetch when offline
      refetchOnMount={true} // ✅ Important: Refetch on mount
    >
      <SessionHandler>
        <RTLProvider>
          <BrandThemeProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              forcedTheme="light"
              enableSystem={false}
              disableTransitionOnChange
            >
              <NavigationProvider>
                <ToastProvider />
                <SessionMonitor />
                {children}
                <Toaster />
              </NavigationProvider>
            </ThemeProvider>
          </BrandThemeProvider>
        </RTLProvider>
      </SessionHandler>
    </SessionProvider>
  );
}; 