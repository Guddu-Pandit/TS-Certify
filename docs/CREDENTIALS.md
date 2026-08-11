# Getting every key and API — step by step

Click-by-click instructions for every credential the app needs. No prior knowledge assumed.

You need **three accounts**, all free:

| Service | What it's for | Cost |
|---|---|---|
| Supabase | Database, login, file storage | Free tier is plenty |
| Google Cloud | Reading your Google Form's responses | Free |
| Gmail | Sending certificates to students | Free (~500 emails/day) |

Work through the parts in order. Each one ends with a command that proves it worked — **run it before moving on.** Fixing one thing at a time is much easier than discovering four broken things at the end.

Everything goes into a file called `.env` in the project folder. If it doesn't exist yet:

```bash
cp .env.example .env
```

> **Never put real keys in `.env.example`.** That file is committed to git and shared. `.env` is the private one, and is ignored by git.

---

# Part 1 — Supabase (3 keys)

## 1.1 Create the project

1. Go to **[supabase.com](https://supabase.com)** → **Start your project** → sign in with GitHub or email.
2. Click **New project**.
3. Fill in:
   - **Name**: `ts-certify`
   - **Database Password**: click Generate, then **save it in your password manager**. You won't need it for this app, but you cannot retrieve it later.
   - **Region**: pick the one nearest your students (e.g. *South Asia (Mumbai)* for India).
4. Click **Create new project** and wait ~2 minutes.

## 1.2 Copy the three keys

1. In the left sidebar: **⚙ Project Settings** → **API**.
2. You'll see:

| On the page | Goes into `.env` as |
|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| **Project API keys → `anon` `public`** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Project API keys → `service_role` `secret`** (click 👁 Reveal) | `SUPABASE_SERVICE_ROLE_KEY` |

Your `.env` should now look like:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
```

> **The two keys look almost identical — check carefully.** Decode them at [jwt.io](https://jwt.io) if unsure: one says `"role": "anon"`, the other `"role": "service_role"`.
>
> The **anon** key is designed to be public and is safe in a browser.
> The **service_role** key bypasses every security rule in the database. Treat it like a root password: never in client code, never in a screenshot, never in a commit.

## 1.3 Create the database tables

1. Left sidebar: **SQL Editor** → **+ New query**.
2. Open `supabase/001_schema.sql` from the project folder, copy **all** of it, paste it in, click **Run**.
3. You should see *Success. No rows returned.*
4. Repeat for **`supabase/002_rls.sql`**, then **`supabase/003_seed.sql`** — in that order.

> **Order matters.** `002` locks down tables that `001` creates; `003` adds data to them.
>
> All three are safe to run again if you make a mistake.
>
> **Red underlines in your editor are normal.** VS Code often assumes SQL files are Microsoft SQL Server. This is PostgreSQL — `create extension`, `create policy` and `$$` blocks are all valid here.

## 1.4 Create the storage bucket

This is where the generated certificate files live.

1. Left sidebar: **Storage** → **New bucket**.
2. Fill in **exactly**:
   - **Name**: `certificates` — lowercase, no spaces
   - **Public bucket**: **OFF** ← leave the toggle off
3. Expand **Additional configuration**:
   - **Restrict file upload size**: `10` MB or more
   - **Allowed MIME types**: enter these two, one per line:
     ```
     application/pdf
     image/png
     ```
4. **Save**.

> ### ⚠️ The MIME types trip people up
>
> It must be **`application/pdf`**. There is no such thing as `image/pdf` — if you enter that, every upload fails at the very last step, *after* a certificate number has already been used up. `npm run check:db` catches this.
>
> If you'd rather not think about it, leave **Allowed MIME types empty** — that permits everything.

> **Why private?** A public bucket makes every certificate permanently downloadable by anyone who guesses the URL, and lets search engines index documents with students' full names on them. The app hands out temporary 5-minute download links instead.

## 1.5 Turn off public sign-up

Without this, anyone on the internet could create themselves an account.

1. Left sidebar: **Authentication** → **Sign In / Providers** → **Email**.
2. Turn **OFF** → *Allow new users to sign up*.
3. **Save**.

From now on, accounts exist only because an admin created one.

## 1.6 Create your login

In a terminal, in the project folder:

```bash
npm run user:create you@example.com 'YourPassword123' admin "Your Name"
```

- Use **single quotes** around the password so characters like `!` and `$` aren't eaten by the shell.
- The last argument is optional.
- Running this again for the same email **resets that person's password** — it's also your account-recovery tool.

## ✅ Check Part 1

```bash
npm run check:db
```

Every line must say **PASS**. It verifies the tables exist, the certificate numbering works, the bucket accepts PDFs, and — importantly — that anonymous visitors genuinely cannot read student data.

---

# Part 2 — Google Sheets (4 values)

Your Google Form already saves responses to a Sheet. This part gives the app **read-only** access to that Sheet using a "service account" — a robot Google account that belongs to the app rather than to you.

## 2.1 Create a Google Cloud project

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)** and sign in with the Google account that owns the Form.
2. At the top, click the project dropdown → **New Project**.
3. **Name**: `ts-certify` → **Create**.
4. Wait for the notification, then make sure that project is selected in the dropdown.

## 2.2 Turn on the Sheets API

1. Left menu (☰) → **APIs & Services** → **Library**.
2. Search **Google Sheets API**.
3. Click it → **Enable**.

> If you skip this you'll get *"Google Sheets API has not been used in project … before or it is disabled."*

## 2.3 Create the service account

1. **APIs & Services** → **Credentials**.
2. **+ Create credentials** → **Service account**.
3. **Service account name**: `google-sheet-sync` → **Create and continue**.
4. **"Grant this service account access to project"** → click **Continue**. **Do not add any roles.**
   Sheets access does not come from roles — it comes from sharing the Sheet, in step 2.5.
5. **Done**.

## 2.4 Download its key file

1. On the **Credentials** page, click the service account you just made.
2. **Keys** tab → **Add key** → **Create new key**.
3. Choose **JSON** → **Create**.
4. A `.json` file downloads. **Keep it safe** — it cannot be downloaded again, only replaced.

Open it in a text editor. It looks like:

```json
{
  "type": "service_account",
  "project_id": "ts-certify-123456",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "google-sheet-sync@ts-certify-123456.iam.gserviceaccount.com",
  ...
}
```

## 2.5 🔴 Share the Sheet with the service account

**This is the step everyone forgets. Skipping it gives you a `403` error with otherwise perfect credentials.**

1. Copy the **`client_email`** value from the JSON — e.g.
   `google-sheet-sync@ts-certify-123456.iam.gserviceaccount.com`
2. Open your Google **Form** → **Responses** tab → click the green **Sheets** icon to open the linked spreadsheet.
3. In the Sheet, click **Share** (top right).
4. Paste the service account email into the box.
5. Set the role to **Viewer**.
6. **Untick "Notify people"** — it's a robot, and the address will bounce.
7. Click **Share** / **Send**.

> Nothing you do in Google Cloud IAM substitutes for this. Google Sheets permissions come from the Sheet's own sharing settings, full stop.

## 2.6 Find your Sheet ID and tab name

**Sheet ID** — look at the spreadsheet's URL:

```
https://docs.google.com/spreadsheets/d/1diiQxRhBR8C_-w8IqRg_UrhbSm1m5d4RCUdtqSkYPDs/edit#gid=0
                                      └──────────── this part is the ID ─────────────┘
```

**Tab name** — the label on the tab at the bottom of the Sheet. Usually `Form Responses 1`. Copy it exactly, including capitals and spaces.

## 2.7 Fill in `.env`

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=google-sheet-sync@ts-certify-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1diiQxRhBR8C_-w8IqRg_UrhbSm1m5d4RCUdtqSkYPDs
GOOGLE_SHEET_TAB=Form Responses 1
```

> ### ⚠️ The private key needs care
>
> Copy the `private_key` value from the JSON **exactly as it appears there**, including the quotes:
>
> - **One single line** — do not add real line breaks
> - **Wrapped in double quotes**
> - Keep the `\n` sequences as the two literal characters `\` and `n`
> - Include the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` parts
>
> Getting this wrong produces `error:1E08010C:DECODER routines::unsupported`.
>
> The other three values need **no quotes** — including `GOOGLE_SHEET_TAB`, even though it has a space in it.

## ✅ Check Part 2

```bash
npm run check:sheet
```

This **writes nothing**. It prints your real column headers, shows which database field each one feeds, lists any it didn't recognise, and previews the first three rows.

**If a column says `MISSING`**, your form's wording differs from what the app expects. Open `src/config/field-map.ts` and add your exact wording:

```ts
{ column: "domain", headers: ["domain", "internship domain", "select your track"] },
```

Then run the check again. Unrecognised columns aren't lost — they're stored automatically and can be mapped later.

---

# Part 3 — Gmail (2 values)

Gmail will not accept your normal password from an app. You need an **App Password** — a separate 16-character password used only by this app, which you can revoke at any time without changing your real one.

## 3.1 Turn on 2-Step Verification

**App Passwords do not exist as an option until this is on.** There is no way around it.

1. Go to **[myaccount.google.com/security](https://myaccount.google.com/security)**.
2. Under *How you sign in to Google*, click **2-Step Verification**.
3. Follow the prompts (usually your phone number).

## 3.2 Create the App Password

1. Go to **[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)**.
   *(If it says the setting isn't available, 2-Step Verification isn't fully on yet — go back to 3.1.)*
2. **App name**: type `ts-certify`.
3. Click **Create**.
4. A yellow box shows 16 characters in four groups: `abcd efgh ijkl mnop`.
5. Copy them — **this is shown only once**.

## 3.3 Fill in `.env`

**Delete the spaces.** Google shows them grouped for readability; they are not part of the password.

```bash
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

- `GMAIL_USER` is the full Gmail address the App Password belongs to. This is also the address students see the certificate arrive from.
- `abcd efgh ijkl mnop` becomes `abcdefghijklmnop` — 16 characters, no spaces, no quotes.

## ✅ Check Part 3

```bash
npm run check:email
```

Sends one test message to yourself. It touches no database and no certificates, so if this works, sending works — and any later problem is somewhere else.

To send the test somewhere else: `npm run check:email someone@example.com`

> **Do this before emailing a real student.**

> Gmail allows roughly **500 recipients per day**. Fine for cohorts; if you need thousands, use a dedicated sending service.

---

# Part 4 — The remaining settings

These need no external account.

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CERT_ID_PREFIX=TS
ORG_NAME=Tech Synergy
CRON_SECRET=
```

| Setting | What it does |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | The web address of this app. **See the warning below.** |
| `CERT_ID_PREFIX` | Certificate numbers become `TS-2026-0001`. Change `TS` to your own initials. |
| `ORG_NAME` | Your organisation's name. Appears in every email. |
| `CRON_SECRET` | Optional. Only needed for automatic scheduled syncing. Any long random string. |

> ### ⚠️ `NEXT_PUBLIC_SITE_URL` gets permanently printed into every QR code
>
> The QR code is a picture. Whatever web address is in it when a certificate is generated is in it **forever** — no later configuration change can repair it.
>
> While testing on your own machine, `http://localhost:3000` is correct. Those QR codes will not work from a phone, which is expected.
>
> **Before generating any certificate you intend to give to a real student**, change this to your real public address (e.g. `https://ts-certify.vercel.app`).
>
> In production the app refuses to generate at all if it still says `localhost`, so this cannot happen by accident.

---

# Final checklist

Run all three. Every line must say PASS:

```bash
npm run check:db       # Supabase
npm run check:sheet    # Google Sheets
npm run check:email    # Gmail
```

Then start the app:

```bash
npm run dev
```

Open **http://localhost:3000**, sign in with the account from step 1.6, and click **Sync now**.

Your completed `.env` should have all thirteen values filled in:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=…
GOOGLE_PRIVATE_KEY="…"
GOOGLE_SHEET_ID=…
GOOGLE_SHEET_TAB=Form Responses 1

# Gmail
GMAIL_USER=…
GMAIL_APP_PASSWORD=…

# Settings
CERT_ID_PREFIX=TS
ORG_NAME=…
CRON_SECRET=
```

---

# If something goes wrong

| Error message | What it means | Fix |
|---|---|---|
| `caller does not have permission` / `403` | The Sheet isn't shared with the robot account | Step 2.5 |
| `Google Sheets API has not been used…` | API not switched on | Step 2.2 |
| `error:1E08010C:DECODER routines` | `GOOGLE_PRIVATE_KEY` is malformed | Step 2.7 — one line, double quotes, literal `\n` |
| `Unable to parse range` | Tab name doesn't match | Step 2.6 — check capitals and spaces |
| `Requested entity was not found` | Wrong Sheet ID | Step 2.6 |
| `Username and Password not accepted` | Using your real password, not an App Password | Step 3.2 |
| App Passwords page unavailable | 2-Step Verification isn't on | Step 3.1 |
| `mime type application/pdf is not supported` | Bucket MIME list is wrong | Step 1.4 |
| `relation "public.submissions" does not exist` | SQL files weren't run | Step 1.3 |
| `Bucket not found` | Bucket missing or misspelled | Step 1.4 — must be exactly `certificates` |
| Login says "Incorrect email or password" | Account not created | Step 1.6 |
| Login says "no access profile" | `001_schema.sql` didn't run | Step 1.3 |

**When in doubt, run `npm run check:db` first** — it inspects the whole setup and tells you precisely what's missing.

---

# Keeping the keys safe

- **`.env` must never be committed.** It's already in `.gitignore` — verify with `git check-ignore .env` (it should print `.env`).
- If a key is ever exposed:
  - **Supabase**: Project Settings → API → **Reset** the service role key
  - **Google**: Credentials → the service account → Keys → delete the old key, add a new one
  - **Gmail**: [App passwords](https://myaccount.google.com/apppasswords) → revoke it, create another
- When deploying, keys go into the host's environment variables panel — never into the code.
