import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeErrorHandling } from "./lib/globalErrorHandler";

// Initialize global error handling
initializeErrorHandling();

createRoot(document.getElementById("root")!).render(<App />);
