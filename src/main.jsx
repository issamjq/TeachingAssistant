import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import StudioApp from "./App.jsx";
import Landing from "./views/Landing.jsx";
import { useRoute, navigate, clearRoute } from "./lib/route.js";
import { LanguageProvider } from "./lib/i18n.jsx";
import { ThemeProvider } from "./lib/theme.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";
import { PageTransition } from "./components/ui/PageTransition.jsx";
import AccessibilityWidget from "./views/AccessibilityWidget.jsx";

function Root() {
  const route = useRoute();
  const inStudio = route !== null;

  useEffect(() => {
    document.body.classList.toggle("studio-open", inStudio);
    if (!inStudio) window.scrollTo(0, 0);
  }, [inStudio]);

  return (
    <>
      <PageTransition pageKey={inStudio ? "studio" : "landing"}>
        {inStudio ? (
          <StudioApp onClose={() => clearRoute()} />
        ) : (
          <Landing onOpenStudio={() => navigate(["planner"])} />
        )}
      </PageTransition>
      <AccessibilityWidget />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
