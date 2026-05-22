import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tsconfigPaths(), tailwindcss()],
  build: {
    outDir: "dist",
    // Keep Vite's default 500KB warning threshold
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'recharts';
            if (id.includes('react')) return 'vendor';
            // admin related heavy pages
            if (id.includes('/src/routes/admin/ai-debug')) return 'aiDebug';
            if (id.includes('/src/routes/admin/rag-audit')) return 'ragAudit';
            if (id.includes('/src/routes/admin')) return 'admin';
          }
        },
      },
    },
  },
});
