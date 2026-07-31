import { defineConfig, loadEnv } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import fs from "fs";
import path from "path";

// A simple Vite plugin to serve Vercel API routes locally during development
const vercelApiDevPlugin = () => ({
  name: "vercel-api-dev",
  configResolved(config: any) {
    // Load env variables into process.env so API routes can use them
    const env = loadEnv(config.mode, process.cwd(), "");
    Object.assign(process.env, env);
  },
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url.startsWith("/api/")) {
        try {
          const apiPath = req.url.split("?")[0];
          const filePath = path.resolve(process.cwd(), "." + apiPath + ".ts");
          if (fs.existsSync(filePath)) {
            // Read body for POST requests
            if (req.method === "POST" || req.method === "PUT") {
              const body = await new Promise((resolve) => {
                let data = "";
                req.on("data", (chunk: any) => (data += chunk));
                req.on("end", () => resolve(data));
              });
              req.rawBody = body;
              try {
                req.body = body ? JSON.parse(body as string) : {};
              } catch (e) {
                req.body = {};
              }
            }

            // Provide JSON helper
            res.json = (data: any) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(data));
            };
            res.status = (code: number) => {
              res.statusCode = code;
              return res;
            };

            // Dynamically import the handler using Vite's server runner or native import
            const module = await server.ssrLoadModule(filePath);
            const handler = module.default;
            if (handler) {
              await handler(req, res);
              return;
            }
          }
        } catch (error) {
          console.error("Vercel API Dev Plugin Error:", error);
          res.statusCode = 500;
          res.end("Internal Server Error");
          return;
        }
      }
      next();
    });
  },
});

export default defineConfig({
  server: {
    port: 5174,
    host: true,
  },
  plugins: [vercelApiDevPlugin(), TanStackRouterVite(), react(), tsconfigPaths(), tailwindcss()],
  test: {
    exclude: [
      ...configDefaults.exclude,
      "supabase/functions/**/*.test.ts",
    ],
  },
  build: {
    outDir: "dist",
    // Keep Vite's default 500KB warning threshold
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts")) return "recharts";
            if (id.includes("react")) return "vendor";
            // admin related heavy pages
            if (id.includes("/src/routes/admin/ai-debug")) return "aiDebug";
            if (id.includes("/src/routes/admin/rag-audit")) return "ragAudit";
            if (id.includes("/src/routes/admin")) return "admin";
          }
        },
      },
    },
  },
});
