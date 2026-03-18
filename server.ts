import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set("trust proxy", 1);
  app.use(express.json());
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
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/auth/google/callback`
    );
  };

  // Auth URL
  app.get("/api/auth/google/url", (req, res) => {
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
    res.json({ isAuthenticated: !!(req.session as any).tokens });
  });

  // List Drive Files
  app.get("/api/drive/files", async (req, res) => {
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
