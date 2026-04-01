import { useState, useEffect, useCallback } from "react";

export type ThemeColor = "orange" | "aqua";
export type ThemeMode = "light" | "dark";

const THEME_KEY = "etax-theme-color";
const MODE_KEY = "etax-theme-mode";

const THEMES: Record<ThemeColor, {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  gradientEnd: string;
  tableHeader: string;
  tableHeaderDark: string;
  tableHeaderDarker: string;
  tableStripe: string;
  tableHover: string;
  label: string;
}> = {
  orange: {
    primary: "#fb9678",
    primaryHover: "#e8876a",
    primaryLight: "#fff3ef",
    gradientEnd: "#e8856a",
    tableHeader: "#fb9678",
    tableHeaderDark: "#e8876a",
    tableHeaderDarker: "#d4785c",
    tableStripe: "#fff8f5",
    tableHover: "#fff3ef",
    label: "ส้ม (Orange)",
  },
  aqua: {
    primary: "#03c9d7",
    primaryHover: "#02a8b3",
    primaryLight: "#e5f9fa",
    gradientEnd: "#02a8b3",
    tableHeader: "#03c9d7",
    tableHeaderDark: "#02b0bc",
    tableHeaderDarker: "#0299a3",
    tableStripe: "#f0fbfc",
    tableHover: "#e5f9fa",
    label: "ทีล (Aqua)",
  },
};

const DARK_OVERRIDES: Record<ThemeColor, {
  primaryLight: string;
  tableStripe: string;
  tableHover: string;
}> = {
  orange: {
    primaryLight: "rgba(251, 150, 120, 0.15)",
    tableStripe: "rgba(251, 150, 120, 0.06)",
    tableHover: "rgba(251, 150, 120, 0.12)",
  },
  aqua: {
    primaryLight: "rgba(3, 201, 215, 0.15)",
    tableStripe: "rgba(3, 201, 215, 0.06)",
    tableHover: "rgba(3, 201, 215, 0.12)",
  },
};

const FAVICON_MAP: Record<ThemeColor, string> = {
  orange: "/favicon.ico",
  aqua: "/favicon-blue.png",
};

function applyTheme(theme: ThemeColor, mode: ThemeMode) {
  const t = THEMES[theme];
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);

  if (mode === "dark") {
    root.classList.add("dark");
    const darkOverride = DARK_OVERRIDES[theme];
    root.style.setProperty("--theme-primary", t.primary);
    root.style.setProperty("--theme-primary-hover", t.primaryHover);
    root.style.setProperty("--theme-primary-light", darkOverride.primaryLight);
    root.style.setProperty("--theme-gradient-end", t.gradientEnd);
    root.style.setProperty("--theme-table-header", t.tableHeader);
    root.style.setProperty("--theme-table-header-dark", t.tableHeaderDark);
    root.style.setProperty("--theme-table-header-darker", t.tableHeaderDarker);
    root.style.setProperty("--theme-table-stripe", darkOverride.tableStripe);
    root.style.setProperty("--theme-table-hover", darkOverride.tableHover);
  } else {
    root.classList.remove("dark");
    root.style.setProperty("--theme-primary", t.primary);
    root.style.setProperty("--theme-primary-hover", t.primaryHover);
    root.style.setProperty("--theme-primary-light", t.primaryLight);
    root.style.setProperty("--theme-gradient-end", t.gradientEnd);
    root.style.setProperty("--theme-table-header", t.tableHeader);
    root.style.setProperty("--theme-table-header-dark", t.tableHeaderDark);
    root.style.setProperty("--theme-table-header-darker", t.tableHeaderDarker);
    root.style.setProperty("--theme-table-stripe", t.tableStripe);
    root.style.setProperty("--theme-table-hover", t.tableHover);
  }

  const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (faviconLink) {
    faviconLink.href = FAVICON_MAP[theme] + "?v=15";
  }
}

function getStoredTheme(): ThemeColor {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "orange" || stored === "aqua") return stored;
  } catch {}
  return "orange";
}

function getStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "light";
}

export function useThemeColor() {
  const [theme, setThemeState] = useState<ThemeColor>(getStoredTheme);
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);

  useEffect(() => {
    applyTheme(theme, mode);
  }, [theme, mode]);

  const setTheme = useCallback((t: ThemeColor) => {
    setThemeState(t);
    try { localStorage.setItem(THEME_KEY, t); } catch {}
    applyTheme(t, getStoredMode());
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem(MODE_KEY, m); } catch {}
    applyTheme(getStoredTheme(), m);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "orange" ? "aqua" : "orange");
  }, [theme, setTheme]);

  const toggleMode = useCallback(() => {
    const newMode = mode === "light" ? "dark" : "light";
    setMode(newMode);
  }, [mode, setMode]);

  const colors = THEMES[theme];
  const isDark = mode === "dark";

  return { theme, setTheme, toggle, colors, themes: THEMES, mode, setMode, toggleMode, isDark };
}

export function initThemeOnLoad() {
  const theme = getStoredTheme();
  const mode = getStoredMode();
  applyTheme(theme, mode);
}
