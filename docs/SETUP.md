# Setup

First-time setup, in the order that lets you check each piece as you go. Budget about 30 minutes.

Each section ends with a command that proves that piece works. Run it before moving on — debugging one integration at a time is far quicker than debugging four at once.

> **Doing this for the first time?** Use **[CREDENTIALS.md](CREDENTIALS.md)** instead — it's the same ground covered click by click, with every screen named and every error explained. This page is the condensed version for when you already know your way around Supabase and Google Cloud.

---

## 0. Install

```bash
npm install
cp .env.example .env
```

`.env` is gitignored. `.env.example` is committed and must stay blank — **never put real keys in it.**

---

## 1. Supabase

### Create the project

1. [supabase.com](https://supabase.com) → **New project**. Pick a region near your users.
2. **Project Settings → API**, copy three values into `.env`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...      # safe to be public
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # SECRET — bypasses all security
```

> The anon key is designed to be public and is safe in a browser. The **service_role key bypasses every access rule** — it must never appear in client code, a screenshot, or a commit.

### Run the SQL

**SQL Editor → New query.** Run these five files in order, one at a time:

| Order | File | Creates |
|---|---|---|
| 1 | `supabase/001_schema.sql` | Tables, the `TS-2026-0001` ID allocator, the admin view |
| 2 | `supabase/002_rls.sql` | Locks every table down; opens one public read for the verify page |
| 3 | `supabase/003_seed.sql` | Default email template + 3 test students |
| 4 | `supabase/004_manual_edits.sql` | Lets staff fill in fields the form left blank, and keeps those edits through re-syncs |
| 5 | `supabase/005_certificate_layout.sql` | Stores the certificate field positions edited at /admin/template |

All five are safe to re-run, so a mistake is recoverable.

> Your editor may underline these files in red. That's a SQL Server linter misreading PostgreSQL — `create extension`, `create policy` and `$$` blocks are all valid Postgres. Ignore it.

### Create the storage bucket

**Storage → New bucket:**

- Name: **`certificates`** (exactly)
- Public: **OFF**
- Allowed MIME types: **`application/pdf`** and **`image/png`**
- File size limit: at least **10 MB**

> Watch the MIME types. `image/pdf` is not a real MIME type — set that and every upload fails at the last step, after a certificate ID has already been used up. `npm run check:db` catches this.

### Turn off public sign-ups

**Authentication → Sign In / Providers → Email → turn OFF "Allow new users to sign up".**

From then on, accounts exist only because an admin created one.

### Create your admin account

```bash
npm run user:create you@example.com 'your-password' admin "Your Name"
```

Re-running this for an existing address resets that person's password, so it doubles as account recovery.

### ✅ Check

```bash
npm run check:db
```

Every line must say PASS. It verifies the tables, the ID allocator, the bucket and its MIME types, and that anonymous users genuinely cannot read student data.

---

## 2. Google Sheets

Your Form already saves responses to a Sheet. This gives the app read-only access to it.

### Create a service account

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project (or pick one).
2. **APIs & Services → Library** → search **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account.** Any name. **No roles needed** — skip that step.
4. Open the new service account → **Keys → Add key → Create new key → JSON**. It downloads.

### 🔴 Share the Sheet with it

**This is the step everyone forgets, and it produces a 403 with otherwise perfect credentials.**

Open the JSON file and find `client_email` — it looks like `something@your-project.iam.gserviceaccount.com`.

Open the Form's **response Sheet → Share** → paste that address → set to **Viewer** → untick "Notify people" → **Send**.

Sheets access comes from *sharing*, not from IAM roles. Nothing you do in Google Cloud IAM will substitute for this.

### Fill in `.env`

From the JSON file:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=something@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1PASTE_YOUR_16_CHARSQrStUvWxYz0123456789
GOOGLE_SHEET_TAB=Form Responses 1
```

**The private key needs care.** Copy the `private_key` value from the JSON *exactly as it appears there* — one line, wrapped in double quotes, with literal `\n` sequences (not real line breaks). Getting this wrong produces `error:1E08010C:DECODER routines::unsupported`.

`GOOGLE_SHEET_ID` is the part of the Sheet's URL between `/spreadsheets/d/` and `/edit`.

`GOOGLE_SHEET_TAB` is the tab label at the bottom of the Sheet.

### ✅ Check

```bash
npm run check:sheet
```

This writes nothing. It prints your real headers, shows which database column each one feeds, lists anything unmapped, and previews the first three rows as they would be stored.

**If a header didn't match**, add your exact wording to `src/config/field-map.ts` and run it again:

```ts
{ column: "domain", headers: ["domain", "internship domain", "select your track"] },
```

Unmatched columns are not lost — they're captured into `submissions.extra` automatically. Mapping them just gives them a proper column.

---

## 3. Gmail

### Create an App Password

1. **Google Account → Security → 2-Step Verification → turn ON.**
   App Passwords do not exist as an option until this is on.
2. **Security → App passwords** → app **Mail**, name it `ts-certify` → **Create**.
3. Copy the 16 characters and **delete the spaces**. Google displays them in groups of four for readability; the spaces are not part of the password.

```bash
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=PASTE_YOUR_16_CHARS
```

### ✅ Check

```bash
npm run check:email                    # sends to yourself
npm run check:email you@example.com    # or to a specific address
```

This touches no database and no certificates, so if it works, SMTP is fine and any later problem is elsewhere. **Do this before emailing a real student.**

> Gmail allows roughly 500 recipients per day. Fine for cohorts; not for thousands.

---

## 4. Remaining settings

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000    # see the warning below
CERT_ID_PREFIX=TS                             # certificates become TS-2026-0001
ORG_NAME=Your Organisation                    # appears in every email
CRON_SECRET=                                  # optional, for scheduled sync
```

> ### ⚠️ `NEXT_PUBLIC_SITE_URL` is permanent in every QR code
>
> The QR is an image. Whatever URL is in it when a certificate is generated is in it forever. A certificate generated while this says `localhost` has a dead QR that no amount of later fixing will repair.
>
> **Set this to your real public URL before generating anything you intend to give to a student.** In production the app refuses to generate at all if it sees `localhost`.

---

## 5. Run it

```bash
npm run dev
```

Open http://localhost:3000, sign in, and you should see the three seeded test students.

### Full walkthrough

1. **Sync now** → your real form responses appear.
2. Click **Sync now** again → `0 new`. That's the duplicate protection working.
3. **Preview** on any row → the certificate renders in a new tab. Nothing is saved.
4. **Generate** → a certificate ID appears.
5. Click that ID → the public verification page.
6. **Send email** → it arrives with the PDF attached.

When you're happy, delete the test students:

```sql
delete from public.submissions where source_key like 'seed-%';
```

---

## 6. Your own certificate design

The shipped artwork is `assets/templates/certificate2.png` (2000×1414). To use your own:

1. Save it as `assets/templates/certificate2.png`, or point `TEMPLATE.file` in `src/config/template.ts` at your filename.
2. Set `width` and `height` in `src/config/template.ts` to its **exact** pixel size.
   The renderer refuses to run on a mismatch rather than producing subtly misaligned certificates.
3. Open **/admin/template** and drag each line where it belongs. Add lines, remove them, or switch one off — and hit **Preview** to render a real sample. Positions save to the database, so this needs `supabase/005_certificate_layout.sql`.
4. `npm run render:sample` → check `sample/`. It renders three cases including a deliberately absurd 47-character name, to prove nothing spills over your borders.

The artwork itself is never edited by the app — text is composited on top of it every time.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `403` / `caller does not have permission` | The Sheet isn't shared with the service account email. §2 above. |
| `error:1E08010C:DECODER routines` | `GOOGLE_PRIVATE_KEY` is malformed. One line, double-quoted, literal `\n`. |
| `Unable to parse range` | `GOOGLE_SHEET_TAB` doesn't match the tab name. |
| `Username and Password not accepted` | Not an App Password, or 2-Step Verification is off. |
| `mime type application/pdf is not supported` | Bucket MIME allowlist. §1 above. |
| Dates off by months | A column mapped to the wrong field — run `npm run check:sheet`. |
| `relation does not exist` | The SQL files haven't been run. `npm run check:db` says which. |
| Anything else | `npm run check:db` first. It names what's broken. |
