# TS-Certify

Turns Google Form internship registrations into verifiable PDF certificates, delivered by email.

Students fill in your Google Form. You pull the responses in with one click, hit **Generate**, and hit **Send**. Each certificate carries a QR code that opens a public page proving the name, domain and duration are genuine — and that page reads live from the database, so a withdrawn certificate stops verifying even if a printed copy still exists.

```
Google Form ──► Google Sheet ──► [Sync now] ──► Supabase
                                                   │
                            [Generate] ──► QR + text on your template
                                        ──► PDF + PNG in private storage
                                                   │
                            [Send email] ──► student's inbox, PDF attached
                                                   │
                                    scan QR ──► /verify/TS-2026-0001
```

**Documentation**

| | |
|---|---|
| **[docs/CREDENTIALS.md](docs/CREDENTIALS.md)** | 🔑 **Start here.** Every key and API, click by click — Supabase, Google, Gmail. |
| [docs/SETUP.md](docs/SETUP.md) | The same setup, condensed, for when you know these services already. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it works inside: data model, security model, request flows. |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Day-to-day use, customising the design and email, troubleshooting. |

---

## Quick start

```bash
npm install
cp .env.example .env       # then fill it in — see docs/SETUP.md
npm run check:db           # confirms Supabase is set up correctly
npm run dev                # http://localhost:3000
```

Sign in with the account created by `npm run user:create`.

---

## What each screen does

| Screen | Purpose |
|---|---|
| **Submissions** | Everyone who filled the form. Sync, search, filter, generate and email — individually or in bulk. |
| **Certificates** | Every certificate ever issued. Filter by year, domain, active/revoked. |
| **Email** | Edit the message students receive. Stored in the database, so changes apply immediately. |
| **Template** | Position text on your certificate artwork by clicking on it. |
| **Users** | *Admins only.* Create `hr` or `admin` accounts, change roles, deactivate people. |
| **/verify/<id>** | Public. What a student — or their employer — sees when they scan the QR code. |

---

## Roles

| | admin | hr |
|---|---|---|
| Sync, generate, email, revoke, view | ✅ | ✅ |
| Edit the email template | ✅ | ✅ |
| Create / deactivate users, change roles | ✅ | ❌ |

There is no public sign-up — accounts exist only because an admin created one. Deactivating someone revokes access on their very next request while keeping their history intact.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Production build |
| `npm run check:db` | Verify Supabase: tables, storage bucket, RLS. **Run this first when anything looks wrong.** |
| `npm run check:sheet` | Show your Google Sheet's headers and which database column each one feeds. Writes nothing. |
| `npm run check:email` | Send one test email. Proves the Gmail App Password in isolation. |
| `npm run render:sample` | Render three sample certificates to `sample/`. No database, no server — the fast loop for tuning the template. |
| `npm run user:create <email> <password> <admin\|hr>` | Create a user, or reset an existing one's password. |

Each `check:*` script isolates one integration, so a failure tells you *which* thing is broken rather than just that something is.

---

## Where to change things

| To change… | Edit |
|---|---|
| Which form question feeds which column | [`src/config/field-map.ts`](src/config/field-map.ts) |
| Where text sits on the certificate | [`src/config/template.ts`](src/config/template.ts) — or use the **Template** screen |
| The certificate artwork | Replace `assets/templates/certificate.png` |
| The email wording | The **Email** screen — no code, no redeploy |
| How duration is worded | `durationLabel()` in [`src/lib/dates.ts`](src/lib/dates.ts) — used by the certificate *and* the email |
| Your organisation name | `ORG_NAME` in `.env` |

---

## Adding a new form field later

Any Google Sheet column that isn't mapped is captured automatically into `submissions.extra`, and the whole row always lands in `submissions.raw`. Nothing is ever lost while you decide.

To promote one to a real column:

```sql
-- 1. In the Supabase SQL editor
alter table public.submissions add column college_year text;
```

```ts
// 2. In src/config/field-map.ts
{ column: "college_year", headers: ["year of study", "current year"] },
```

```sql
-- 3. Backfill the history that was already captured
update public.submissions
set college_year = extra->>'Year of Study'
where extra ? 'Year of Study';
```

---

## Tech

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · `@napi-rs/canvas` for rendering · `pdf-lib` · `nodemailer` · `googleapis`

Fonts are Montserrat and Great Vibes, both SIL Open Font License — see `assets/fonts/`.
