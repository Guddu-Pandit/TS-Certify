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
| **Edit** / **Complete details** | Opens the record and lets you type in what the form did not collect. See [Filling in what the form missed](#filling-in-what-the-form-missed). |
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

## Filling in what the form missed

Not every row arrives complete. A student skips the end date, mistypes their email, or the
form never had a question for their college. Those rows show what is missing rather than a
blank dash:

- The cell itself becomes a dashed **`+ email`** / **`+ domain`** button.
- The Status column shows **"2 fields missing"**.
- The actions column shows **Complete details** in amber instead of **Edit**.
- **Generate** is disabled while a *required* field is blank, because it would fail anyway.

Click any of them and the same dialog opens with everything you know about that person.
Missing fields are outlined in amber and labelled with what they block:

| Field | Missing means |
|---|---|
| Full name, Domain, Start date, End date | **No certificate can be issued** |
| Email | The certificate can be made, but never delivered |
| Phone, School / College | Only the record is incomplete |

**Both admin and HR can edit.** Filling gaps is the day-to-day work of running the queue,
not an administrative act.

> 💡 The missing answer is often already in the sheet, in a column no field claims yet.
> Expand **Other answers from the form** inside the dialog before going hunting.

### Edits survive re-syncing

This is the part that matters. `Sync now` upserts every row from the sheet, so without
protection your hand-typed end date would be replaced by the blank cell it came from on the
very next sync.

Every field you change is recorded as **manually owned**. The sync re-applies those on top
of the sheet data, so the edit is permanent. Sync reports how many rows this affected:
*"3 rows kept hand-typed values instead of the sheet's."* Edited rows carry a ✎ next to the
name.

**To hand a row back to the sheet** — you fixed the mistake in Google Forms, or you typed
the wrong thing — open it and click **Release to sheet**. The stored values stay as they
are; the next sync is simply free to overwrite them again.

> ⚠️ **Editing does not change a certificate already issued.** Certificates hold their own
> snapshot on purpose. Fill in the details, then **Re-generate** to pick them up.

### Adding another editable field

`src/config/editable-fields.ts` is the whole list. Add an entry — the column must exist on
`public.submissions` — and it appears in the dialog, in the missing-field counts, and in the
sync's protection, with no other change.

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

There are two separate things here, and keeping them apart is the whole point:

| | Where it lives | Who changes it |
|---|---|---|
| The **artwork** | `assets/templates/certificate2.png` | A designer, by replacing the file |
| **Where text sits** on it | `public.certificate_layouts`, edited at **/admin/template** | Staff, from the browser |

The renderer never modifies the artwork. It loads the image, draws the text and the QR on top, and saves the result — so a layout you dislike is always one **Reset to defaults** away from the positions in `src/config/template.ts`.

### Moving what gets printed

Open **Template** in the nav.

- **Drag a marker** to move a line. Arrow keys nudge by 1px, Shift+arrow by 10.
- The panel on the right sets the text, font, size, colour, alignment and max width of whatever is selected.
- **Print** off keeps a line's position but leaves it off the certificate. `domain` and `institution` ship off, because the artwork's own paragraph already covers the internship.
- **+ Add line** prints anything else you want — literal text, `{{tokens}}`, or both: `Awarded in {{domain}}`. Same placeholders as the email editor.
- **Preview** renders a real sample through the actual generator. Use the *very long name* sample before trusting a max width — the browser markers cannot show you shrinking or clipping.
- **Save** applies to certificates generated **from then on**. Already-issued PDFs are frozen snapshots; re-generate a submission to move it onto the new layout.

Saving needs `supabase/005_certificate_layout.sql` to have been applied. Without it the screen still works, but says it is falling back to defaults.

### Swapping in different artwork

1. Save it as `assets/templates/certificate2.png` (or point `TEMPLATE.file` at your filename).
2. Set `width`/`height` in `src/config/template.ts` to its **exact** pixel dimensions.
3. Reposition the fields at **/admin/template**.
4. `npm run render:sample`, look at `sample/`, adjust, repeat.

The renderer **refuses to run** if the image size doesn't match the config. That is deliberate: a mismatch would place every field slightly wrong and produce plausible-looking but incorrect certificates, which is worse than an error.

### Field settings

```ts
{
  key: "fullName",
  label: "Recipient name",   // what the editor calls it
  text: "{{name}}",          // literal text and placeholders
  x: 1000, y: 720,           // y is the text BASELINE, not the top
  align: "center",           // decides whether x is the left, centre or right edge
  font: "GreatVibes",
  size: 130,
  color: "#c9a227",
  maxWidth: 1150,            // shrink to stay inside this
  minSize: 60,               // shrink floor — then wrap instead
  wrap: true,                // allow a second line (names only)
  enabled: true,             // off = keep the position, skip the printing
}
```

### Resolution

The current artwork is 2000×1414. That prints acceptably at A4 landscape but is not 300 dpi — if you need print-shop sharpness, ask for the same design exported at 3508×2480 and update `width`/`height`.

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
