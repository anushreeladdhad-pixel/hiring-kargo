# Kargo Hiring Dashboard

Internal tool for one person (Arjun): upload a CV, pick the role, and the
system scores it against the hiring rubric, ranks it against everyone else
who applied for that role, writes a 3-sentence interview brief for anyone
above the line, and drafts a personalised invite or rejection email.
Nothing is sent until Arjun opens the candidate, reads the brief and the
draft, and clicks Send.

Repo: https://github.com/anushreeladdhad-pixel/hiring-kargo

## How it works

1. **Upload** — pick PM or SPM, upload a CV (`.pdf`, `.docx`, or `.txt`).
2. **PII split** — name, email, and phone are extracted and stored only in
   the `candidates` table. Everything else (the sanitized CV text) is what
   gets sent to Gemini. No AI call ever sees the raw file or the PII.
3. **Scoring** — the sanitized text is scored against **both** the PM and
   the SPM rubric (regardless of which role the candidate applied for), so
   the dashboard shows both numbers for comparison.
4. **Shortlist** — after every new upload, the whole cohort for that role is
   re-ranked by score against their own role's rubric. The top N (default 5,
   see `settings.shortlist_size_pm` / `_spm`) are marked shortlisted. If a
   new candidate bumps someone off the shortlist, that person's brief/draft
   is regenerated as a rejection — unless their email has already been
   sent, in which case they're never touched again.
5. **Brief** — a 3-sentence interview brief is generated for shortlisted
   candidates only (who they are, why they ranked here, what to probe).
6. **Draft** — an email is drafted for every candidate: an interview invite
   if shortlisted, a warm rejection if not. Gemini writes to a `[NAME]`
   placeholder; the real name is substituted afterward from the private
   `candidates` row, not from anything the model produced.
7. **Review & send** — the dashboard lists every candidate ranked by score.
   Opening a candidate shows the full score breakdown (both rubrics), the
   brief, and the editable draft. **Send** fires the email via Resend and
   locks the draft.

## Stack

- **Next.js 14** (App Router, TypeScript) — pages, API routes, deployed to Vercel
- **Supabase** (Postgres) — candidates, scores, briefs, drafts, rubric, settings
- **Gemini Flash** — scoring, briefs, email drafts (the only AI step; never
  sees personal details)
- **Resend** — sends the final emails
- **GitHub** — version control

## One-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/migrations/0001_init.sql`.
3. Go to Project Settings → API and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never
     expose this in client code or commit it)

### 3. Get a Gemini API key

Create a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
→ `GEMINI_API_KEY`. Default model is `gemini-2.0-flash`
(`GEMINI_MODEL` in `.env` if you want to change it).

### 4. Get a Resend API key

1. Create a free account at [resend.com](https://resend.com).
2. Verify a sending domain (or use their test domain while developing).
3. Create an API key → `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL` to a verified sender, e.g.
   `"Arjun Mehta <arjun@yourdomain.com>"`.

### 5. Set an access code

Set `APP_ACCESS_CODE` to any long random string — this is the only thing
standing between the dashboard and the open internet, since it's a
single-user internal tool with no login system. Leave it blank in local
dev if you don't want the gate.

### 6. Fill in your environment

```bash
cp .env.example .env.local
# edit .env.local with the values above
```

### 7. Seed the rubric and job descriptions

```bash
npm run seed:rubric   # loads data/rubric.json into rubric_criteria
npm run seed:jds       # loads data/jd_pm.txt and data/jd_spm.txt into role_context
```

Re-run `seed:rubric` any time you edit `data/rubric.json` — it's the single
source of truth; don't hand-edit rows in Supabase directly, or the rubric
in the DB and `rubric.txt`'s intent will drift apart.

### 8. Run locally

```bash
npm run dev
```

Open http://localhost:3000, enter your access code, and upload a CV.

## Deploying to Vercel

```bash
npm i -g vercel   # if you don't have it
vercel
```

Then, in the Vercel project settings → Environment Variables, add every key
from `.env.local`. Redeploy after adding them (`vercel --prod`).

> Uploading + scoring + briefing + drafting all happen inside one request
> (`/api/upload`), which can take 15-30 seconds depending on Gemini's
> response time. `maxDuration = 60` is set on that route — this requires a
> Vercel plan that supports functions longer than 10s (Pro or above). On
> Hobby, either upgrade or split the pipeline into a background job.

## Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial Kargo hiring dashboard"
git branch -M main
git remote add origin https://github.com/anushreeladdhad-pixel/hiring-kargo.git
git push -u origin main
```

`.env.local` is gitignored — never commit real API keys.

## Known limitations (by design, given the founder's constraints)

- **Name extraction is heuristic, not AI-verified.** It looks for a
  2-4-word, title-case line near the top or bottom of the CV that isn't a
  section header. This matches every sample CV in this case, but an
  unusual layout could slip through — the founder should glance at the
  extracted name on `/candidates/[id]` the first time a new CV format shows
  up.
- **Shortlist size is a fixed top-N per role** (`settings` table), not a
  score threshold — change the two rows in `settings` to adjust it.
- **Re-ranking only fires on new uploads.** If you manually edit
  `shortlist_size_pm/spm` in Supabase, existing candidates won't
  automatically re-rank until the next CV is uploaded for that role — or
  hit **Retry pipeline** on any one candidate in that role to force it.
- **JDs are reference-only.** They're stored in `role_context` and used
  solely to help write the "what to probe" line in interview briefs — they
  are never part of the scoring prompt, matching the rubric's own "not
  derived from the job descriptions" ground rule.
