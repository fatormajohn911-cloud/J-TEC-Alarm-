# AI Wake Backend (`aiwake-api`)

Node.js 22 + TypeScript + Hono proxy server for AI Wake (`gemini-2.5-flash` chat with `gemini-2.5-flash-lite` scope guard and `gemini-2.5-flash-preview-tts` voice audio), backed by Upstash Redis daily quotas and HS256 JWT device tokens.

## Required Environment Variables

Set these on Render (never commit secrets):

- `GEMINI_TEXT_KEY` — Gemini API key for text chat and scope guard
- `GEMINI_VOICE_KEY` — Gemini API key for Gemini TTS
- `TOKEN_SIGNING_SECRET` — long random string (32+ chars) for HS256 JWT signing
- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST endpoint URL
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token
- `ALLOWED_ORIGINS` — comma-separated list of allowed web origins (for example `https://<USER>.github.io`)

## Endpoints (`/v1`)

- `GET /v1/health` — Render health check and warm-up ping
- `GET /v1/config` — app version gate (`minAppVersion`), kill switch (`aiEnabled`), quotas, and limits
- `POST /v1/register` — issues a 30-day HS256 JWT for an `installId` UUID (max 20/IP/day)
- `POST /v1/chat` — authenticated chat proxy with server-side system prompt, scope guard, safety settings, and daily quotas (40/install/day, 150/IP/day)
- `POST /v1/speak` — authenticated TTS proxy returning binary `audio/wav` (max 600 chars, 15/install/day, 150/IP/day)

## Deploying on Render

Note: `render.yaml` starts on `plan: free` for initial testing; **switch to `starter` in the Render dashboard before launch** so the service does not sleep between wake-up requests.

1. Create a free Upstash Redis database in the Upstash dashboard and copy its `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
2. In the Render dashboard, choose **New + -> Blueprint** (or **Web Service**) and connect this GitHub repository. Render reads `/render.yaml` (`rootDir: backend`, `buildCommand: npm install && npm run build`, `startCommand: npm start`, `healthCheckPath: /v1/health`).
3. In the Render service's **Environment** tab, add the 6 secret environment variables listed above (`ALLOWED_ORIGINS` should include your GitHub Pages origin, e.g. `https://USER.github.io`).
4. Deploy and verify `https://<your-service>.onrender.com/v1/health` returns `{"ok":true,...}`.
5. Set GitHub repository variable `VITE_API_BASE_URL` to `https://<your-service>.onrender.com` (in GitHub Repo **Settings -> Secrets and variables -> Actions -> Variables**) so GitHub Pages and Android builds connect to it.
6. Before public launch, upgrade the Render instance plan from **Free** to **Starter** in **Settings -> Instance Type**.

## Local Development

```bash
cd backend
npm install
npm run build
npm start
```
