"use client";

import { useTheme } from "./ThemeProvider";

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const COMPOUND_USER_DATA_KEY = "COMPOUND_USER_DATA_v3";

function setDarkModeInStorage(isDark: boolean) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(COMPOUND_USER_DATA_KEY);
    const parsed = raw ? (JSON.parse(raw) as { version?: number; user?: Record<string, unknown> }) : null;
    const user = parsed?.user ?? { id: "gachaboard-app" };
    const next = { version: 3, user: { ...user, isDarkMode: isDark } };
    window.localStorage.setItem(COMPOUND_USER_DATA_KEY, JSON.stringify(next));
    document.documentElement.classList.toggle("dark", isDark);
    document.dispatchEvent(new CustomEvent("gachaboard-theme-change", { detail: { isDarkMode: isDark } }));
  } catch {
    /* ignore */
  }
}

export function ThemeToggle() {
  const { isDarkMode } = useTheme();

  const handleClick = () => {
    const next = !isDarkMode;
    setDarkModeInStorage(next);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      title={isDarkMode ? "ライトモードにする" : "ダークモードにする"}
    >
      {isDarkMode ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
