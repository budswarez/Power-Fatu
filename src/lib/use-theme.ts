"use client";

import { useState, useEffect } from "react";

export type Theme = "dark" | "light";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const saved = (localStorage.getItem("power-fatu-theme") as Theme) || "dark";
      setTheme(saved);
    } catch {
      // SSR / private mode
    }
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("power-fatu-theme", next);
      document.documentElement.setAttribute("data-theme", next);
    } catch {
      // ignore
    }
  }

  return { theme, toggle };
}
