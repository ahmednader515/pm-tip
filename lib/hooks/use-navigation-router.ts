"use client";

import { useRouter as useNextRouter } from "next/navigation";
import { useNavigation } from "@/lib/contexts/navigation-context";
import { useCallback } from "react";

/**
 * Custom router hook that automatically triggers navigation loading
 * Use this instead of useRouter from next/navigation for automatic loading overlay
 */
export const useNavigationRouter = () => {
  const router = useNextRouter();
  const { startNavigating } = useNavigation();

  const push = useCallback((href: string) => {
    startNavigating();
    router.push(href);
  }, [router, startNavigating]);

  const replace = useCallback((href: string) => {
    startNavigating();
    router.replace(href);
  }, [router, startNavigating]);

  return {
    ...router,
    push,
    replace,
  };
};

