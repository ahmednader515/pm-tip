"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function SessionMonitor() {
  const { data: session, status } = useSession();
  const t = useTranslations("common");
  const isLoggingOutRef = useRef(false);
  const toastShownRef = useRef(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    if (!toastShownRef.current) {
      toast.error(t("sessionExpired"));
      toastShownRef.current = true;
    }

    await signOut({ redirect: false });

    if (typeof document !== "undefined") {
      document.cookie.split(";").forEach((c) => {
        const cookieName = c.trim().split("=")[0];
        if (cookieName.includes("next-auth") || cookieName.includes("authjs")) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    window.location.href = "/";
  }, [t]);

  useEffect(() => {
    if (status === "authenticated" && session) {
      const isExpired = session.expires &&
        session.expires !== "1970-01-01T00:00:00.000Z" &&
        new Date(session.expires) < new Date();

      const hasInvalidUser = !session.user?.id || session.user.id === "";

      if (isExpired || hasInvalidUser) {
        handleLogout();
      }
    }
  }, [status, session, handleLogout]);

  useEffect(() => {
    if (status !== "authenticated" || !session) return;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store"
        });

        if (response.status === 401) {
          handleLogout();
          return;
        }

        const sessionData = await response.json();

        if (!sessionData?.user?.id || sessionData.user.id === "") {
          handleLogout();
          return;
        }
      } catch (error) {
        // Don't logout on network errors
      }
    };

    const initialDelay = setTimeout(() => {
      checkSession();
      const interval = setInterval(checkSession, 5000);
      return () => clearInterval(interval);
    }, 2000);

    return () => clearTimeout(initialDelay);
  }, [status, session, handleLogout]);

  return null;
}
