import { useEffect } from "react";

export function useForceLightMode() {
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (wasDark) root.classList.remove("dark");
    return () => { if (wasDark) root.classList.add("dark"); };
  }, []);
}
