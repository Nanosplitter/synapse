import { defineConfig } from "vite";

export default defineConfig({
  envDir: "../",
  server: {
    allowedHosts: ["connections.nanosplitter.com", ".trycloudflare.com"],
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        ws: true
      }
    },
    hmr: {
      clientPort: 443
    }
  },
  build: {
    outDir: "dist",
    assetsDir: "assets"
  }
});
