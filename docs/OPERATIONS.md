# Operations

Day-to-day use, customising, and what to do when something misbehaves.

---

## Issuing certificates to a cohort

The normal end-of-batch routine:

1. **Sync now** — pulls the latest form responses. Safe to click any time; existing rows are updated, not duplicated.
2. **Filter** to the cohort — by domain, or search their institution.
3. **Select all** with the header checkbox.
4. **Generate N** — the sticky bar at the bottom. Progress is shown as it works through them.
5. Spot-check one: click its certificate ID and confirm the public page looks right.
6. **Email N** — confirms first, then sends. The PDF is attached to each message.

Rows that already have a certificate are skipped automatically, so re-running a bulk action after adding a few late registrations is safe.

### Status meanings

| Badge | Means |
|---|---|
| **New** | Synced from the form. No certificate yet. |
| **Generated** | Certificate created and stored. Not emailed. |
| **Emailed** | Delivered. |
| **Email failed** | Last send attempt failed — open the student's page for the exact error. |
| **Revoked** | Withdrawn. Its QR now reports as unverified. |

Status is *derived* from whether a certificate row and an email log entry exist. There is no stored flag, so it cannot disagree with reality.

---

## Individual actions

| Button | What it does |
|---|---|
| **Preview** | Renders live in a new tab. **Saves nothing** — no file, no database row, no certificate ID used. Use it freely. |
| **Generate** | Issues a certificate. |
| **Re-generate** | Same ID, version +1, refreshed details. |
| **PDF** | Downloads via a link that expires in 5 minutes. |
| **Send email** / **Resend** | Emails the PDF. Resending asks for confirmation. |
| **Revoke** | Withdraws it. Optional reason, kept for the record. |

### Re-generate or revoke?

**Re-generate** when the certificate is *correct in principle* but needs redoing — the template changed, or a name was misspelled. The ID stays the same, so **QR codes on copies already printed and handed out keep working**.

**Revoke** when the certificate should never have existed — issued to the wrong person, or the internship was withdrawn. The old QR immediately reports "could not be verified", which is the entire point of having verification. You can then issue a fresh certificate to that student under a new ID.

> ⚠️ **Re-generating does not recall an email already sent.** The student still has the old PDF in their inbox. The app warns you and offers Resend.

---

## Editing the email

**Email** in the nav. Subject, HTML body, plain-text body and attachment filename.

Changes are stored in the database and take effect immediately — no code change, no redeploy.

Click any placeholder chip to insert it:

| Placeholder | Example |
|---|---|
| `{{name}}` | Aarav Sharma |
| `{{firstName}}` | Aarav |
| `{{domain}}` | Web Development |
| `{{duration}}` | 8 Weeks (12 Jan 2026 to 09 Mar 2026) |
| `{{startDate}}` / `{{endDate}}` | 12 Jan 2026 |
| `{{institution}}` | Delhi Technological University |
| `{{certificateId}}` | TS-2026-0001 |
| `{{verifyUrl}}` | https://…/verify/TS-2026-0001 |
| `{{issuedOn}}` | 12 Aug 2026 |
| `{{orgName}}` | From `ORG_NAME` in `.env` |

The right-hand pane previews the result against a sample student as you type. If you mistype a placeholder — `{{studentName}}` — the editor flags it as unknown **before** it goes out as literal text to a real person.

**Keep both bodies in sync.** Email clients that block HTML fall back to the plain-text version, and some people read it by preference.

---

## Changing the certificate design

Everything about the layout lives in one file: `src/config/template.ts`. No coordinate appears anywhere else in the codebase.

### Swapping in your own artwork

1. Save it as `assets/templates/certificate.png`.
2. Set `width`/`height` in the config to its **exact** pixel dimensions.
3. Open **Template** in the nav and click where each field belongs — it reports the coordinates.
4. `npm run render:sample`, look at `sample/`, adjust, repeat.

The renderer **refuses to run** if the image size doesn't match the config. That is deliberate: a mismatch would place every field slightly wrong and produce plausible-looking but incorrect certificates, which is worse than an error.

### Field settings

```ts
fullName: {
  x: 1754, y: 1190,        // y is the text BASELINE, not the top
  align: "center",         // decides whether x is the left, centre or right edge
  font: "GreatVibes",
  size: 190,
  color: "#12284c",
  maxWidth: 2000,          // shrink to stay inside this
  minSize: 90,             // shrink floor — then wrap instead
  wrap: true,              // allow a second line (names only)
},
```

`print: [...]` at the bottom of the file controls which fields are actually drawn. Remove one to leave it off the certificate while keeping its coordinates. `institution` is off by default.

### Resolution

The default is 3508×2480 — A4 landscape at 300 dpi, which prints crisply. Anything much smaller will look soft in print.

---

## Adding a form field

Any Sheet column not in `field-map.ts` is captured into `submissions.extra` automatically, and the whole row always lands in `submissions.raw`. **Nothing is lost while you decide** — you can see both on any student's page.

To promote one to a real column:

```sql
alter table public.submissions add column college_year text;
```

```ts
// src/config/field-map.ts
{ column: "college_year", headers: ["year of study", "current year"] },
```

```sql
-- backfill the history already captured
update public.submissions
set college_year = extra->>'Year of Study'
where extra ? 'Year of Study';
```

Run `npm run check:sheet` to confirm the mapping before syncing.

---

## Managing people

**Users** (admins only).

- **Create** — set a password and hand it over; they can't self-register.
- **Deactivate** — revokes access on their very next request, while keeping their history. Preferred over deletion.
- **Change role** — `hr` ↔ `admin`.
- **Reset a password** — `npm run user:create <their-email> <new-password> <role>`

You cannot deactivate yourself or remove your own admin role — that would lock you out of the only screen that undoes it.

---

## Troubleshooting

**Start with `npm run check:db`.** It verifies tables, the storage bucket and its MIME types, and that anonymous users genuinely cannot read student data. It names what's broken.

Then narrow down with whichever check matches the symptom — each isolates one integration:

| Symptom | Command |
|---|---|
| Sync fails or maps wrongly | `npm run check:sheet` |
| Email won't send | `npm run check:email` |
| Certificate looks wrong | `npm run render:sample` |

### Common problems

| Symptom | Fix |
|---|---|
| Sync: `403 / caller does not have permission` | The Sheet isn't shared with the service account. See SETUP §2. |
| Sync: "no sheet column matched: domain" | Add your exact header wording to `field-map.ts`. |
| Dates wrong by months | A column is mapped to the wrong field — `npm run check:sheet`. |
| Row skipped: "full_name is required" | That form response has a blank name. Fix it in the Sheet, sync again. |
| Generate: `mime type … not supported` | Bucket MIME allowlist. Needs `application/pdf` and `image/png`. |
| Generate: "Template size mismatch" | The image isn't the size `template.ts` claims. Update the config. |
| Name overflows the border | Lower `maxWidth`/`minSize` for `fullName`, then `npm run render:sample`. |
| Email: `Username and Password not accepted` | Not an App Password, or 2-Step Verification is off. |
| Email: quota exceeded | Gmail's ~500/day cap. Wait, or move to a dedicated sending service. |
| **QR codes don't scan** | `NEXT_PUBLIC_SITE_URL` was `localhost` at generation time. See below. |

### QR codes that don't work

The URL is baked into the image at generation time, so it cannot be fixed by changing configuration afterwards.

1. Set `NEXT_PUBLIC_SITE_URL` to the real public URL.
2. **Re-generate** the affected certificates — same IDs, new QR codes.
3. **Resend** to anyone who already received one.

To check what a QR actually contains, click the certificate ID in the table — that link goes to the same URL the code encodes.

---

## Housekeeping

**Remove the test students** once you're live:

```sql
delete from public.submissions where source_key like 'seed-%';
```

Their certificates and email logs go with them (cascade).

**Scheduled sync** (optional). Set `CRON_SECRET` in the environment and add to `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/sync", "schedule": "0 3 * * *" }] }
```

Without `CRON_SECRET` the route stays closed rather than falling open to the public.

**Records to keep.** `email_log` is append-only and holds every delivery attempt with its error. `certificates` keeps revoked rows rather than deleting them. Between them you can answer "what did we issue to whom, and did it arrive" for any past student.
