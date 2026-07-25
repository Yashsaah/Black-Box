import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const KEY = "bb-theme";
const ThemeCtx = createContext(null);

// The paint colour behind the browser chrome, per theme.
const CHROME = { dark: "#07080a", light: "#f6f4f0" };

const systemTheme = () =>
  window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";

const stored = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
};

/** Paint the theme onto <html> before React commits, so nothing flashes. */
function apply(theme, animate) {
  const root = document.documentElement;

  if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("theming");
    window.clearTimeout(apply._t);
    apply._t = window.setTimeout(() => root.classList.remove("theming"), 420);
  }

  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", CHROME[theme]);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    typeof window === "undefined" ? "dark" : document.documentElement.dataset.theme || "dark"
  );
  // Null means "no explicit pick yet" — keep tracking the OS until they choose.
  const [choice, setChoice] = useState(() => (typeof window === "undefined" ? null : stored()));

  useEffect(() => {
    if (choice) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = () => setTheme(systemTheme());
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [choice]);

  // Only cross-fade on a real change — the first pass is already painted.
  const booted = useRef(false);
  useEffect(() => {
    apply(theme, booted.current);
    booted.current = true;
  }, [theme]);

  const set = useCallback((next) => {
    setChoice(next);
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode — the theme still holds for this session */
    }
  }, []);

  const toggle = useCallback(() => set(theme === "dark" ? "light" : "dark"), [set, theme]);

  const value = useMemo(() => ({ theme, setTheme: set, toggle }), [theme, set, toggle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
