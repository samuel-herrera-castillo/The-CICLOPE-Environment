import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 * CORS proxy middleware — allows browser dev mode to fetch any URL
 * via the Vite dev server, bypassing CORS restrictions.
 * In production (Tauri), direct fetch() works natively without CORS.
 */
function corsProxyPlugin() {
  return {
    name: "kdcm-cors-proxy",
    configureServer(server: any) {
      server.middlewares.use("/api/proxy", async (req: any, res: any) => {
        const targetUrl = req.url?.split("?url=")[1];
        if (!targetUrl) { res.statusCode = 400; res.end("Missing ?url= param"); return; }
        try {
          const decoded = decodeURIComponent(targetUrl);
          const response = await fetch(decoded, {
            headers: { "User-Agent": "KDCM/1.0" },
          });
          res.statusCode = response.status;
          res.setHeader("Content-Type", response.headers.get("content-type") || "text/html");
          res.setHeader("Access-Control-Allow-Origin", "*");
          const body = await response.arrayBuffer();
          res.end(Buffer.from(body));
        } catch (e: any) {
          res.statusCode = 502;
          res.end(`Proxy error: ${e.message}`);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    tailwindcss(),
    react(),
    corsProxyPlugin(),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
