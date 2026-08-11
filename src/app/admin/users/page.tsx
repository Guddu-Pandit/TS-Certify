import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CreateUserForm } from "./CreateUserForm";
import { UserRow, type UserRowData } from "./UserRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users · TS-Certify" };

const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted";

export default async function UsersPage() {
  // Redirects an hr user away even if they type the URL directly.
  const me = await requireAdmin();

  const { data, error } = await supabaseAdmin()
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at")
    .order("created_at", { ascending: true });

  const users = (data ?? []) as UserRowData[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Administrators can do everything and manage accounts. HR / Staff can sync the form,
          generate certificates and send emails, but cannot manage accounts.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Add a user</h2>
        <CreateUserForm />
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <div className="table-scroll">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="border-b border-line bg-brand-soft/40">
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Email</th>
                <th className={TH}>Role</th>
                <th className={TH}>Status</th>
                <th className={TH}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === me.id} />
              ))}
            </tbody>
          </table>
        </div>

        {error ? (
          <p className="border-t border-line px-4 py-3 text-sm text-red-700">{error.message}</p>
        ) : null}
      </section>

      <p className="text-xs text-muted">
        Deactivating revokes access on the user&rsquo;s very next request while keeping their
        history intact. To reset someone&rsquo;s password, re-run{" "}
        <code className="font-mono">npx tsx scripts/create-user.ts &lt;email&gt; &lt;new-password&gt; &lt;role&gt;</code>.
      </p>
    </div>
  );
}
