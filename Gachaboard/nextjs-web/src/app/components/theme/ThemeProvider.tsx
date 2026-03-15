"use client";

import { createContext, useContext, useEffect, useState } from "react";

const COMPOUND_USER_DATA_KEY = "COMPOUND_USER_DATA_v3";
const BROADCAST_CHANNEL = "tldraw-user-sync";
const BROADCAST_EVENT = "tldraw-user-preferences-change" as const;

function getIsDarkModeFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(COMPOUND_USER_DATA_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as { user?: { isDarkMode?: boolean } } | null;
    return data?.user?.isDarkMode ?? false;
  } catch {
    return false;
  }
}

type ThemeContextValue = { isDarkMode: boolean };

const ThemeContext = createContext<ThemeContextValue>({ isDarkMode: false });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const apply = (value: boolean) => {
      setIsDarkMode(value);
      document.documentElement.classList.toggle("dark", value);
    };

    apply(getIsDarkModeFromStorage());

    const channel =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(BROADCAST_CHANNEL) : null;

    const handleMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; data?: { user?: { isDarkMode?: boolean } } };
      if (data?.type === BROADCAST_EVENT && data?.data?.user != null) {
        apply(data.data.user.isDarkMode ?? false);
      }
    };

    channel?.addEventListener("message", handleMessage);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === COMPOUND_USER_DATA_KEY && e.newValue) {
        try {
          const data = JSON.parse(e.newValue) as { user?: { isDarkMode?: boolean } };
          apply(data?.user?.isDarkMode ?? false);
        } catch {
          /* ignore */
        }
      }
    };

    const handleThemeChange = (e: Event) => {
      const detail = (e as CustomEvent<{ isDarkMode: boolean }>).detail;
      if (detail != null) apply(detail.isDarkMode);
    };

    window.addEventListener("storage", handleStorage);
    document.addEventListener("gachaboard-theme-change", handleThemeChange);

    return () => {
      channel?.removeEventListener("message", handleMessage);
      channel?.close();
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("gachaboard-theme-change", handleThemeChange);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ isDarkMode }}>{children}</ThemeContext.Provider>
  );
}
