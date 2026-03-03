# Public Read-Only Deployment Guide

This guide describes how to run a public read-only tree site while keeping all editing local-only.

## Terminology

- Viewer: browser caller identity (anonymous/admin/editor role).
- Owner: application-level data owner with files under `datasets/<owner>/`.

These are separate concepts. A viewer may access one owner depending on authorization rules.

## 1) Hosting baseline (cheap + reliable)

- Use a small Linux VPS (2 GB RAM class is enough for light traffic).
- Put Caddy/Nginx in front for HTTPS.
- Run backend API on localhost only (`127.0.0.1:8000`).
- Serve frontend static build from the reverse proxy.
- Optional: place Cloudflare in front for additional bot and DDoS filtering.

## 2) Public-mode configuration

Backend public env example:
- `backend/.env.public.example`

Frontend public env example:
- `frontend/.env.public.example`

Important flags:
- `APP_MODE=public` enforces read-only server behavior.
- `ENABLE_API_DOCS=false` hides docs in production.
- `CORS_ORIGINS=https://your-public-frontend-domain` keeps CORS strict.
- `RATE_LIMIT_PER_MINUTE` enables app-layer throttling.

## 3) Security baseline checklist

- Keep admin/editing instance local only; do not expose it publicly.
- Expose only ports 80/443 publicly; restrict SSH.
- Use SSH key auth, disable password auth.
- Enable unattended OS security updates.
- Keep dependency updates regular (`pip`, `npm`).
- Keep backups for both local primary data and public replica.
- Monitor logs and set alerting for repeated 4xx/5xx spikes.

## 4) Build and deploy frontend (public)

Example:

```bash
cd frontend
npm ci
npm run build
```

Deploy `frontend/dist` to your server path, for example:
- `/srv/gedcom-public/frontend-dist`

## 5) Run public API service

1. Create backend env file from `backend/.env.public.example`.
2. Install Python dependencies.
3. Start service with systemd template.
4. Verify:
   - `GET /health` works
   - write calls return `403 Read-only public mode`

## 6) Publish data from local to public

Export datasets locally:

```bash
python tools/deployment/export_datasets.py --owner inovoseltsev
```

Upload the generated `.zip` to server, then import:

```bash
python tools/deployment/import_datasets.py --archive /path/to/datasets.zip
```

The import script keeps release backups and atomically switches active public data.

## 7) Rollback

If a newly published snapshot release has issues (for example, partial upload, missing media, or schema mismatch):
- stop API service
- replace `current` with previous directory from `backups`
- start API service again

## 8) Smoke test after each publish

- Open `/tree` and verify full graph renders.
- Click random people and verify focused tree opens.
- Open person detail and verify read-only behavior.
- Confirm dashboard/edit URLs are unavailable in public frontend.
- Confirm `POST/PUT/DELETE` API calls are rejected.
