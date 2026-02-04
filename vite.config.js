import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // This defines 'global' and 'React' for libraries that expect them
    global: "window",
    React: "window.React",
  },
  optimizeDeps: {
    // Force Vite to process these specific libraries
    include: ["react-filerobot-image-editor", "pdfjs-dist"],
  },
});
