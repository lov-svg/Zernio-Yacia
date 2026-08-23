# Base44 Dev Environment

This repo runs an Instagram analytics dashboard: a React (CRA + craco) frontend + a FastAPI backend, backed by Postgres, with Supabase for auth, Zernio for Instagram data, and Anthropic for idea generation.

## Running

```bash
docker compose -f docker-compose.base44.yml up -d
```

- Frontend (CRA dev server, live reload) → host port **3000** (the preview entry point)
- Backend (uvicorn `--reload`) → host port **8000**
- Postgres → internal compose service `db` (no host port)

## How it's wired (dev mode)

- App code runs from the bind-mounted source (`./backend`, `./frontend`), NOT from a baked image — edits appear via live reload.
- Frontend dev server: `HOST=0.0.0.0`, `DANGEROUSLY_DISABLE_HOST_CHECK=true`, polling watchers enabled (bind mounts need it). The API base is `REACT_APP_BACKEND_URL=https://8000-${BASE44_PUBLIC_HOST_SUFFIX}` (separate origin); backend CORS is `*`.
- Backend deps install on container start (heavy `requirements.txt` incl. litellm from an internal wheel URL); a pip cache volume speeds restarts. Frontend deps install on start via `npm install --legacy-peer-deps`.

## Secrets / credentials

`.env.base44-defaults` holds **placeholders** so the stack boots before real credentials exist. Real values are delivered by the platform to `/run/base44/app.env` (outside the repo) and override the placeholders (it is listed as the LAST `env_file:` entry in compose).

External services that need real credentials:
- **Zernio** — `ZERNIO_API_KEY`, `ZERNIO_ACCOUNT_ID` (Instagram data; backend reads `ZERNIO_ACCOUNT_ID` at import time)
- **Anthropic** — `ANTHROPIC_API_KEY` (idea generation via Claude)
- **Supabase** — `SUPABASE_JWT_SECRET` (backend token verification), `REACT_APP_SUPABASE_URL` + `REACT_APP_SUPABASE_ANON_KEY` (frontend auth)

With placeholders the backend boots and the frontend renders the login page; real credentials are required to log in and load dashboard data.

## Verifying it works

```bash
docker compose -f docker-compose.base44.yml ps
curl -sf http://localhost:8000/api/        # → {"message":"Dashboard Instagram API"}
curl -sf -H "Host: x.example" http://localhost:3000/ | head   # → CRA HTML shell
```

## Notes / quirks

- `db.py` calls `metadata.create_all` on first connection, so tables auto-create — no migration step needed.
- Backend auth middleware (`AuthMiddleware`) requires a Supabase JWT Bearer token on `/api/*` except public paths (`/api`, `/api/profile-picture`).
- The original `docker-compose.yml` builds production images (nginx-served static frontend) — do NOT use it for dev; use `docker-compose.base44.yml`.
