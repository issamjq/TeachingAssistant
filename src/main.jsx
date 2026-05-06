import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import StudioApp from "./App.jsx";
import Landing from "./views/Landing.jsx";

function Root() {
  const [view, setView] = useState("landing");

  useEffect(() => {
    document.body.classList.toggle("studio-open", view === "studio");
    if (view === "landing") window.scrollTo(0, 0);
  }, [view]);

  if (view === "studio") {
    return <StudioApp onClose={() => setView("landing")} />;
  }
  return <Landing onOpenStudio={() => setView("studio")} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
