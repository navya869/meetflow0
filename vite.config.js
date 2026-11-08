import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = Number(env.PORT || process.env.PORT || 8000);
  const frontendPort = Number(env.VITE_PORT || process.env.VITE_PORT || 5173);

  return {
    root: fileURLToPath(new URL("./client/", import.meta.url)),
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: frontendPort,
      strictPort: false,
      proxy: {
        "/api": { target: `http://127.0.0.1:${apiPort}` },
        "/ws": { target: `ws://127.0.0.1:${apiPort}`, ws: true },
        "/static": { target: `http://127.0.0.1:${apiPort}` },
        "/meetings": { target: `http://127.0.0.1:${apiPort}` }
      }
    }
  };
});
