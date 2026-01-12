import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // This provides a global 'React' variable to libraries that need it
    "window.React": "React",
  },
});
