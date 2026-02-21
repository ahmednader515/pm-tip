"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useNavigation } from "@/lib/contexts/navigation-context";

const NavigationLoadingContent = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isNavigating, startNavigating, stopNavigating } = useNavigation();
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevLocationRef = useRef<string>("");
  const isInitialMount = useRef(true);

  // Listen for link clicks and navigation events
  useEffect(() => {
    const currentPath = window.location.pathname;
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check for Link components (Next.js Link wraps in <a>)
      const link = target.closest('a');
      if (link && link.href && !link.href.startsWith('#') && !link.target && !link.hasAttribute('download')) {
        try {
          const url = new URL(link.href);
          if (url.origin === window.location.origin && url.pathname !== currentPath) {
            // Small delay to avoid flickering on fast navigations
            if (navigationTimeoutRef.current) {
              clearTimeout(navigationTimeoutRef.current);
            }
            navigationTimeoutRef.current = setTimeout(() => {
              startNavigating();
            }, 50);
          }
        } catch (e) {
          // Invalid URL, ignore
        }
      }
      
      // Check for buttons that might trigger navigation
      const button = target.closest('button');
      if (button) {
        // Check if button is inside a Link
        const parentLink = button.closest('a');
        if (parentLink && parentLink.href && !parentLink.href.startsWith('#') && !parentLink.target) {
          try {
            const url = new URL(parentLink.href);
            if (url.origin === window.location.origin && url.pathname !== currentPath) {
              if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
              }
              navigationTimeoutRef.current = setTimeout(() => {
                startNavigating();
              }, 50);
            }
          } catch (e) {
            // Invalid URL, ignore
          }
        }
        
        // Check if button is in dashboard sidebar or navigation area
        // These buttons often trigger router.push()
        const isInNavigationArea = button.closest('[role="navigation"]') || 
                                   button.closest('nav') ||
                                   button.closest('[data-navigation]') ||
                                   (button.closest('aside') && window.location.pathname.includes('/dashboard'));
        
        if (isInNavigationArea && !button.disabled) {
          // Assume navigation might happen, show loading after a short delay
          // This will be cancelled if pathname doesn't change
          if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
          }
          navigationTimeoutRef.current = setTimeout(() => {
            // Only show if pathname hasn't changed yet (navigation is in progress)
            if (window.location.pathname === currentPath) {
              startNavigating();
            }
          }, 150);
        }
      }
    };

    // Intercept Next.js router navigation by listening to route changes
    // Next.js App Router uses pushState/replaceState internally
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    let lastPath = currentPath;

    history.pushState = function(...args) {
      const result = originalPushState.apply(history, args);
      // Use a small delay to check if path actually changed
      setTimeout(() => {
        const newPath = window.location.pathname;
        if (newPath !== lastPath && newPath !== pathname) {
          lastPath = newPath;
          if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
          }
          navigationTimeoutRef.current = setTimeout(() => {
            startNavigating();
          }, 50);
        }
      }, 0);
      return result;
    };

    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(history, args);
      setTimeout(() => {
        const newPath = window.location.pathname;
        if (newPath !== lastPath && newPath !== pathname) {
          lastPath = newPath;
          if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
          }
          navigationTimeoutRef.current = setTimeout(() => {
            startNavigating();
          }, 50);
        }
      }, 0);
      return result;
    };

    document.addEventListener('click', handleClick, true);
    const handlePopState = () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      navigationTimeoutRef.current = setTimeout(() => {
        startNavigating();
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleClick, true);
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      window.removeEventListener('popstate', handlePopState);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [pathname, startNavigating]);

  const searchParamsString = searchParams?.toString() ?? "";
  const currentLocation = `${pathname}?${searchParamsString}`;

  // Stop loading when pathname or search params change
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevLocationRef.current = currentLocation;
      return;
    }

    if (prevLocationRef.current !== currentLocation) {
      prevLocationRef.current = currentLocation;

      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }

      // Stop shortly after any location change to avoid stale overlays
      stopTimeoutRef.current = setTimeout(() => {
        stopNavigating();
      }, 100);
    }

    return () => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
    };
  }, [currentLocation, stopNavigating]);

  // Safety timeout: ensure overlay never gets stuck indefinitely
  useEffect(() => {
    if (isNavigating) {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
      safetyTimeoutRef.current = setTimeout(() => {
        stopNavigating();
      }, 6000);
      return () => {
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
        }
      };
    }

    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, [isNavigating, stopNavigating]);

  if (!isNavigating) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-black/60 via-black/50 to-black/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* Animated background circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-brand/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '700ms' }} />
      </div>
      
      {/* Loading Card */}
      <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl p-10 shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-800">
        {/* Spinner Container with gradient ring */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand via-brand/80 to-brand/60 blur-lg opacity-40 animate-pulse" />
          <div className="relative bg-white dark:bg-gray-900 rounded-full p-4">
            <Loader2 className="h-14 w-14 text-brand animate-spin" strokeWidth={2.5} />
          </div>
        </div>
        
        {/* Loading Text */}
        <div className="text-center space-y-1">
          <p className="text-base font-bold bg-gradient-to-r from-brand to-brand/80 bg-clip-text text-transparent">
            جاري التحميل...
          </p>
          <p className="text-xs text-muted-foreground">
            يرجى الانتظار
          </p>
        </div>
        
        {/* Animated dots */}
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-brand/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-brand/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};

export const NavigationLoading = () => {
  return (
    <Suspense fallback={null}>
      <NavigationLoadingContent />
    </Suspense>
  );
};

