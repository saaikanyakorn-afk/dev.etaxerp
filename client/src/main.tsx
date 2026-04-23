import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initThemeOnLoad } from "@/hooks/use-theme-color";

initThemeOnLoad();

createRoot(document.getElementById("root")!).render(<App />);

if (typeof (window as any).__removeInitialLoader === "function") {
  (window as any).__removeInitialLoader();
}
