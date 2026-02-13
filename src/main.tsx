import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import App from "./App.tsx";
import { SiteLoader } from "./components/SiteLoader.tsx";
import "./index.css";
import { HelmetProvider } from 'react-helmet-async';

function Root() {
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <HelmetProvider>
      {showLoader && <SiteLoader />}
      <App />
    </HelmetProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
