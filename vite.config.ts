import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { google } from 'googleapis';
import session from 'express-session';
import express from 'express';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  const getOAuthClient = () => {
    return new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      `${env.APP_URL}/auth/google/callback`
    );
  };

  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'api-plugin',
        configureServer(server) {
          // Use express as a middleware for session handling
          const app = express();
          app.set('trust proxy', 1);
          app.use(express.json());
          app.use(session({
            secret: 'luxury-archive-secret',
            resave: false,
            saveUninitialized: true,
            cookie: {
              secure: true,
              sameSite: 'none',
              httpOnly: true,
            },
          }));

          // API Routes
          app.get('/api/health', (req, res) => {
            res.json({ 
              status: 'ok', 
              env: {
                hasClientId: !!env.GOOGLE_CLIENT_ID,
                hasClientSecret: !!env.GOOGLE_CLIENT_SECRET,
                hasAppUrl: !!env.APP_URL,
              }
            });
          });

          app.get('/api/auth/google/url', (req, res) => {
            if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
              return res.status(500).json({ error: 'Google OAuth credentials missing' });
            }
            const client = getOAuthClient();
            const url = client.generateAuthUrl({
              access_type: 'offline',
              scope: [
                'https://www.googleapis.com/auth/drive.metadata.readonly',
                'https://www.googleapis.com/auth/drive.readonly'
              ],
              prompt: 'consent',
            });
            res.json({ url });
          });

          app.get('/auth/google/callback', async (req, res) => {
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
              console.error('Error getting tokens', error);
              res.status(500).send('Authentication failed');
            }
          });

          app.get('/api/auth/google/status', (req, res) => {
            res.json({ isAuthenticated: !!(req.session as any).tokens });
          });

          app.get('/api/drive/files', async (req, res) => {
            const tokens = (req.session as any).tokens;
            if (!tokens) {
              return res.status(401).json({ error: 'Not authenticated' });
            }
            const client = getOAuthClient();
            client.setCredentials(tokens);
            const drive = google.drive({ version: 'v3', auth: client });
            try {
              const response = await drive.files.list({
                pageSize: 20,
                fields: 'nextPageToken, files(id, name, size, mimeType, webViewLink, iconLink)',
                q: 'trashed = false',
              });
              res.json(response.data.files);
            } catch (error) {
              console.error('Error listing files', error);
              res.status(500).json({ error: 'Failed to list files' });
            }
          });

          app.post('/api/auth/google/logout', (req, res) => {
            req.session.destroy(() => {
              res.json({ success: true });
            });
          });

          // Mount the express app to Vite's server
          server.middlewares.use(app);
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
