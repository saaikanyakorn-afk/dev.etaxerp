import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "@fontsource/sarabun/300.css";
import "@fontsource/sarabun/400.css";
import "@fontsource/sarabun/500.css";
import "@fontsource/sarabun/600.css";
import "@fontsource/sarabun/700.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { initThemeOnLoad } from "@/hooks/use-theme-color";

initThemeOnLoad();

createRoot(document.getElementById("root")!).render(<App />);

if (typeof (window as any).__removeInitialLoader === "function") {
  (window as any).__removeInitialLoader();
}
