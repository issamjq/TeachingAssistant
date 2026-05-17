import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import StudioApp from "./App.jsx";
import Landing from "./views/Landing.jsx";
import { useRoute, navigate, clearRoute } from "./lib/route.js";
import { LanguageProvider } from "./lib/i18n.jsx";

// Top-level surface decided by the URL hash:
//   no hash         → landing page
//   any "#/..."     → studio
function Root() {
  const route = useRoute();
  const inStudio = route !== null;

  useEffect(() => {
    document.body.classList.toggle("studio-open", inStudio);
    if (!inStudio) window.scrollTo(0, 0);
  }, [inStudio]);

  if (inStudio) {
    return <StudioApp onClose={() => clearRoute()} />;
  }
  return <Landing onOpenStudio={() => navigate(["planner"])} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <Root />
    </LanguageProvider>
  </React.StrictMode>
);
