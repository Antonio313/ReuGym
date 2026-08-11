# ReuGym

A personal workout tracking PWA — offline-first (Dexie/IndexedDB) with a Supabase backend for sync across devices, real email/password auth, and an AI-assisted onboarding wizard that builds your first program from a short intake form.

## Stack

Vite + React + TypeScript, Tailwind v4, Zustand, Dexie, Supabase (Postgres + Auth + Storage + Edge Functions), Claude (Anthropic API) for the setup wizard.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in your own Supabase project's URL/keys
npm run dev
```

## Self-hosting / forking

This repo's own `supabase/migrations/` (the numbered history of schema changes made against the live project) isn't tracked in git — it's this project's private history, not a generic starting point. If you're setting up your own Supabase project instead:

1. Create a new Supabase project.
2. Paste `supabase/schema.example.sql` into the SQL editor and run it — it's a single consolidated bootstrap of the full current schema (tables, RLS policies, storage bucket, the auth trigger that creates a profile row on signup), with no personal data baked in.
3. Copy `.env.example` to `.env.local` and fill in your project's URL/anon key.
4. Deploy `supabase/functions/ai-assistant` (via the Supabase Dashboard's Edge Functions editor) and set its secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.
5. Configure Auth → SMTP Settings with your own email provider (the shared default sender has a very low rate limit) and require email confirmation under Auth → Settings.
6. Sign up through the app once, then (optionally) run `scripts/seed-default-exercises.mjs` with your service role key to populate the shared exercise library, and grant yourself admin — see the commented block at the end of `supabase/schema.example.sql`.
