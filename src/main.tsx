import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "./services/supabase-client";

// Add this wrapper component to handle auth redirects
function AuthWrapper() {
  useEffect(() => {
    // This will parse the auth response from the URL hash
    // and store the session data when the app first loads
    const { data, error } = supabase.auth.getSession();

    if (error) {
      console.error("Error getting session:", error);
    }

    // Sets up a listener for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          event === "SIGNED_IN" &&
          window.location.hash.includes("access_token")
        ) {
          // After sign in, remove the hash to clean up the URL
          window.location.hash = "";
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<AuthWrapper />);
