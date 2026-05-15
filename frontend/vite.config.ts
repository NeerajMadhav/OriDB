import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8037", changeOrigin: true },
      "/ws": { target: "ws://127.0.0.1:8037", ws: true },
    },
  },
});
