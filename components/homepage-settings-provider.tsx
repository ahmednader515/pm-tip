"use client";

import { createContext, useContext } from "react";
import {
    DEFAULT_HOMEPAGE_CONTENT,
    type HomepageContent,
} from "@/lib/homepage";

const HomepageSettingsContext = createContext<HomepageContent>(
    DEFAULT_HOMEPAGE_CONTENT
);

export function HomepageSettingsProvider({
    children,
    settings,
}: {
    children: React.ReactNode;
    settings: HomepageContent;
}) {
    return (
        <HomepageSettingsContext.Provider value={settings}>
            {children}
        </HomepageSettingsContext.Provider>
    );
}

export function useHomepageSettings() {
    return useContext(HomepageSettingsContext);
}
