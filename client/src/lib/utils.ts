import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function objectPathToUrl(objectPath: string | null | undefined): string {
  if (!objectPath) return "";
  const match = objectPath.match(/\/objects\/uploads\/(.+)/);
  if (match) return `/api/file/${match[1]}`;
  if (objectPath.startsWith("/api/")) return objectPath;
  return objectPath;
}

export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
