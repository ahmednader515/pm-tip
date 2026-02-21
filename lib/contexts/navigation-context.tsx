"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface NavigationContextType {
  isNavigating: boolean;
  startNavigating: () => void;
  stopNavigating: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [isNavigating, setIsNavigating] = useState(false);

  const startNavigating = useCallback(() => {
    setIsNavigating(true);
  }, []);

  const stopNavigating = useCallback(() => {
    setIsNavigating(false);
  }, []);

  return (
    <NavigationContext.Provider value={{ isNavigating, startNavigating, stopNavigating }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
};

