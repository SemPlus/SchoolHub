import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === "production";

  app.use(express.json());

  // Health Check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      env: {
        nodeEnv: process.env.NODE_ENV ?? "development",
      },
    });
  });

  // API 404 handler - catch any /api requests that didn't match above
  app.all("/api/*", (req, res) => {
    console.warn(`404 API Route: ${req.method} ${req.url}`);
    res.status(404).json({
      error: "API route not found",
      method: req.method,
      path: req.url,
    });
  });

  if (!isProduction) {
    // Vite middleware for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
