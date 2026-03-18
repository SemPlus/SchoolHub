import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import { google } from "googleapis";
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

  const getOAuthClient = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = process.env.APP_URL;

    if (!clientId || !clientSecret || !appUrl) {
      console.error("Missing OAuth configuration:", {
        clientId: !!clientId,
        clientSecret: !!clientSecret,
        appUrl: !!appUrl
      });
    }

    return new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${appUrl}/auth/google/callback`
    );
  };

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasAppUrl: !!process.env.APP_URL,
        nodeEnv: process.env.NODE_ENV
      }
    });
  });

  // Auth URL
  app.get("/api/auth/google/url", (req, res) => {
    console.log("GET /api/auth/google/url hit");
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      return res.status(500).json({ error: "Google OAuth credentials missing" });
    }
    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/drive.readonly"
      ],
      prompt: "consent",
    });
    res.json({ url });
  });

  // Callback
  app.get("/auth/google/callback", async (req, res) => {
    console.log("GET /auth/google/callback hit");
    const { code } = req.query;
    const client = getOAuthClient();
    try {
      const { tokens } = await client.getToken(code as string);
      (req.session as any).tokens = tokens;
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error getting tokens", error);
      res.status(500).send("Authentication failed");
    }
  });

  // Check Auth
  app.get("/api/auth/google/status", (req, res) => {
    console.log("GET /api/auth/google/status hit");
    res.json({ isAuthenticated: !!(req.session as any).tokens });
  });

  // List Drive Files
  app.get("/api/drive/files", async (req, res) => {
    console.log("GET /api/drive/files hit");
    const tokens = (req.session as any).tokens;
    if (!tokens) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const client = getOAuthClient();
    client.setCredentials(tokens);
    const drive = google.drive({ version: "v3", auth: client });

    try {
      const response = await drive.files.list({
        pageSize: 20,
        fields: "nextPageToken, files(id, name, size, mimeType, webViewLink, iconLink)",
        q: "trashed = false",
      });
      res.json(response.data.files);
    } catch (error) {
      console.error("Error listing files", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // Logout
  app.post("/api/auth/google/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
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
