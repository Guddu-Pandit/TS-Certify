/**
 * Creates (or updates) an app user.
 *
 *   npx tsx scripts/create-user.ts <email> <password> [admin|hr] ["Full Name"]
 *
 * Examples:
 *   npx tsx scripts/create-user.ts someone@example.com 'S3cret!' hr "Asha R"
 *   npx tsx scripts/create-user.ts boss@example.com 'S3cret!' admin
 *
 * Uses the service-role key, so it works even though public sign-ups are
 * disabled. Re-running for an existing email resets that user's password and
 * role instead of failing, which makes it a usable "reset my login" tool.
 *
 * Day to day you should create users from /admin/users instead; this script
 * exists to bootstrap the first admin, before anyone can log in.
 */
// Next.js loads .env on its own; plain `tsx` does not, so pull it in here.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const [email, password, roleArg = "hr", fullName] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: npx tsx scripts/create-user.ts <email> <password> [admin|hr] [\"Full Name\"]");
  process.exit(1);
}
if (roleArg !== "admin" && roleArg !== "hr") {
  console.error(`Role must be "admin" or "hr", got "${roleArg}".`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // The role travels in app_metadata, which users cannot edit themselves.
  // The on_auth_user_created trigger reads it when inserting the profile row.
  const attrs = {
    email,
    password,
    email_confirm: true, // no confirmation mail — an admin vouched for them
    app_metadata: { role: roleArg },
    user_metadata: fullName ? { full_name: fullName } : {},
  };

  let userId: string;
  const created = await admin.auth.admin.createUser(attrs);

  if (created.error) {
    const alreadyExists =
      created.error.status === 422 || /already/i.test(created.error.message);
    if (!alreadyExists) throw created.error;

    // Existing account: find it and update in place.
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;

    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
      throw new Error(`Supabase says ${email} exists but it was not in the user list.`);
    }

    const updated = await admin.auth.admin.updateUserById(existing.id, attrs);
    if (updated.error) throw updated.error;

    userId = existing.id;
    console.log(`Updated existing user ${email} (password and role reset).`);
  } else {
    userId = created.data.user.id;
    console.log(`Created user ${email}.`);
  }

  // The trigger normally writes this row, but upserting makes the script work
  // even if 001_schema.sql has not been applied yet, and repairs a profile
  // whose role drifted from app_metadata.
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName ?? null,
      role: roleArg,
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (profileErr) throw profileErr;

  console.log(`Role: ${roleArg}`);
  console.log(`\nSign in at /login with this email and password.`);
}

main().catch((err) => {
  console.error("\nFailed:", err.message ?? err);
  process.exit(1);
});
