import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Frontend calls relative "/api/v1/..." paths; Vite forwards them to
      // the FastAPI backend during dev. Keeps CORS out of the picture and
      // mirrors a same-origin setup behind a reverse proxy in production.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        ws: true, // needed for the pipeline WebSocket at /api/v1/pipeline/ws/{job_id}
      },
    },
  },
});