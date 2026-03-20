import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

fs.writeFileSync("server_executed.txt", `Executed at ${new Date().toISOString()}`);
console.log("SERVER.TS IS BEING EXECUTED");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    res.setHeader("X-App-Server", "Luxury-Archive");
    next();
  });
  app.use(express.json());

  // TEST ROUTE - Very top
  app.get("/api/test-routing", (req, res) => {
    res.send("Routing is working!");
  });

  app.get("/test-direct", (req, res) => {
    res.send("Direct routing is working!");
  });

  app.use(
    session({
      secret: "luxury-archive-secret",
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: true,
        sameSite: "none",
        httpOnly: true,
      },
    })
  );

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: {
        nodeEnv: process.env.NODE_ENV
      }
    });
  });

  // API 404 handler - Catch any /api requests that didn't match above
  app.all("/api/*", (req, res) => {
    console.warn(`404 API Route: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "API route not found",
      method: req.method,
      path: req.url 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
